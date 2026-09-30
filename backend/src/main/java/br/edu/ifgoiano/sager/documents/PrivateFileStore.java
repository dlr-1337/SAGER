package br.edu.ifgoiano.sager.documents;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.FileTime;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Immutable UUID-addressed storage. The caller owns and closes the supplied input stream. */
@Component
@Profile({ "local", "production" })
public class PrivateFileStore {
    private static final int BUFFER_SIZE = 8192;
    private final Path root;
    private final Object rootKey;
    private final FileTime rootCreationTime;
    private final long maxBytes;
    private final AtomicMover mover;

    @Autowired
    public PrivateFileStore(
            @Value("${sager.documents.private-root:${user.home}/.sager/private-documents}") String root,
            @Value("${sager.documents.max-bytes:10485760}") long maxBytes) {
        this(configuredPath(root), maxBytes);
    }

    public PrivateFileStore(Path root, long maxBytes) {
        this(root, maxBytes, (source, target) -> Files.move(source, target, StandardCopyOption.ATOMIC_MOVE));
    }

    PrivateFileStore(Path configuredRoot, long maxBytes, AtomicMover mover) {
        if (configuredRoot == null || !configuredRoot.isAbsolute()
                || maxBytes <= 0 || maxBytes > Integer.MAX_VALUE - 8 || mover == null) {
            throw new PrivateFileException("Configuração inválida do armazenamento privado.");
        }
        for (Path component : configuredRoot) {
            if (component.toString().equals("..") || component.toString().equals(".")) {
                throw new PrivateFileException("Raiz inválida do armazenamento privado.");
            }
        }
        try {
            Path absolute = configuredRoot.toAbsolutePath().normalize();
            validateAncestors(absolute);
            Files.createDirectories(absolute);
            validateAncestors(absolute);
            Path real = absolute.toRealPath();
            // A junction or alias that resolves elsewhere is rejected as well as symbolic links.
            if (!real.equals(absolute)) {
                throw new PrivateFileException("Raiz inválida do armazenamento privado.");
            }
            validateAncestors(real);
            this.root = real;
            BasicFileAttributes rootAttributes = attributes(real);
            this.rootKey = rootAttributes.fileKey();
            this.rootCreationTime = rootAttributes.creationTime();
            this.maxBytes = maxBytes;
            this.mover = mover;
        } catch (IOException | SecurityException exception) {
            throw new PrivateFileException("Não foi possível validar o armazenamento privado.");
        }
    }

    public StoredFile storeImmutable(UUID id, InputStream input) {
        if (id == null || input == null) {
            throw new PrivateFileException("Arquivo privado inválido.");
        }
        Path target = root.resolve(id.toString());
        Path reservation = root.resolve(id + ".lock");
        Path temporary = null;
        boolean reservationOwned = false;
        try {
            validateRoot();
            // CREATE_NEW reserves this UUID across instances/processes before checking its target.
            Files.createFile(reservation);
            reservationOwned = true;
            if (Files.exists(target, LinkOption.NOFOLLOW_LINKS)) {
                throw new PrivateFileException("O arquivo privado já foi armazenado.");
            }
            temporary = Files.createTempFile(root, id + "-", ".part");
            MessageDigest digest = sha256Digest();
            long size = 0;
            try (FileChannel output = FileChannel.open(temporary,
                    Set.of(StandardOpenOption.WRITE, LinkOption.NOFOLLOW_LINKS))) {
                byte[] buffer = new byte[BUFFER_SIZE];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (count == 0) {
                        int next = input.read();
                        if (next == -1) {
                            break;
                        }
                        buffer[0] = (byte) next;
                        count = 1;
                    }
                    if (count > maxBytes - size) {
                        throw new PrivateFileException("O arquivo excede o limite do armazenamento privado.");
                    }
                    ByteBuffer chunk = ByteBuffer.wrap(buffer, 0, count);
                    while (chunk.hasRemaining()) {
                        output.write(chunk);
                    }
                    digest.update(buffer, 0, count);
                    size += count;
                }
                output.force(true);
            }
            validateRoot();
            if (Files.exists(target, LinkOption.NOFOLLOW_LINKS)) {
                throw new PrivateFileException("O arquivo privado já foi armazenado.");
            }
            requireRegularFile(temporary);
            // Never fall back to a non-atomic move. No STORED result exists before this returns.
            mover.move(temporary, target);
            StoredFile stored = new StoredFile(id, HexFormat.of().formatHex(digest.digest()), size,
                    StoredFile.STORED);
            // Detect post-write absence/corruption and return only confirmed metadata.
            openVerified(stored);
            return stored;
        } catch (IOException | SecurityException exception) {
            throw new PrivateFileException("Não foi possível armazenar o arquivo privado.");
        } finally {
            deleteOwnedTemporary(temporary);
            if (reservationOwned) {
                deleteOwnedTemporary(reservation);
            }
        }
    }

    /** Returns bytes only after validating the persisted state, length and digest. */
    public byte[] openVerified(StoredFile file) {
        if (file == null || file.id() == null || !StoredFile.STORED.equals(file.state())
                || file.size() < 0 || file.size() > maxBytes || file.sha256() == null
                || !file.sha256().matches("[0-9a-f]{64}")) {
            throw new PrivateFileException("Metadados inválidos do arquivo privado.");
        }
        try {
            validateRoot();
            Path path = root.resolve(file.id().toString());
            BasicFileAttributes before = requireRegularFile(path);
            if (before.size() != file.size()) {
                throw new PrivateFileException("O arquivo privado está ausente ou não está íntegro.");
            }
            MessageDigest digest = sha256Digest();
            ByteArrayOutputStream bytes = new ByteArrayOutputStream((int) file.size());
            long count = 0;
            try (FileChannel input = FileChannel.open(path,
                    Set.of(StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS))) {
                ByteBuffer buffer = ByteBuffer.allocate(BUFFER_SIZE);
                int read;
                while ((read = input.read(buffer)) != -1) {
                    if (read > file.size() - count || read > maxBytes - count) {
                        throw new PrivateFileException("O arquivo privado está ausente ou não está íntegro.");
                    }
                    digest.update(buffer.array(), 0, read);
                    bytes.write(buffer.array(), 0, read);
                    count += read;
                    buffer.clear();
                }
            }
            BasicFileAttributes after = requireRegularFile(path);
            validateRoot();
            if (count != file.size() || after.size() != file.size()
                    || !Objects.equals(before.fileKey(), after.fileKey())
                    || !MessageDigest.isEqual(HexFormat.of().parseHex(file.sha256()), digest.digest())) {
                throw new PrivateFileException("O arquivo privado está ausente ou não está íntegro.");
            }
            return bytes.toByteArray();
        } catch (IOException | SecurityException exception) {
            throw new PrivateFileException("O arquivo privado está ausente ou não está íntegro.");
        }
    }

    private void validateRoot() throws IOException {
        validateAncestors(root);
        BasicFileAttributes current = attributes(root);
        // The Windows provider does not expose fileKey. Creation time remains stable on writes/moves.
        if (!root.toRealPath().equals(root) || !Objects.equals(current.fileKey(), rootKey)
                || rootKey == null && !current.creationTime().equals(rootCreationTime)) {
            throw new PrivateFileException("A raiz do armazenamento privado não está íntegra.");
        }
    }

    private static void validateAncestors(Path path) throws IOException {
        Path ancestor = path.getRoot();
        for (Path component : path) {
            if (component.toString().equalsIgnoreCase("public")) {
                throw new PrivateFileException("A raiz do armazenamento deve ser privada.");
            }
            ancestor = ancestor.resolve(component);
            if (Files.exists(ancestor, LinkOption.NOFOLLOW_LINKS)) {
                BasicFileAttributes attributes = attributes(ancestor);
                if (attributes.isSymbolicLink() || !attributes.isDirectory()) {
                    throw new PrivateFileException("Raiz inválida do armazenamento privado.");
                }
            }
        }
    }

    private static BasicFileAttributes requireRegularFile(Path path) throws IOException {
        BasicFileAttributes attributes = attributes(path);
        if (!attributes.isRegularFile() || attributes.isSymbolicLink()) {
            throw new PrivateFileException("O arquivo privado está ausente ou não está íntegro.");
        }
        return attributes;
    }

    private static BasicFileAttributes attributes(Path path) throws IOException {
        return Files.readAttributes(path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
    }

    private void deleteOwnedTemporary(Path path) {
        if (path == null) {
            return;
        }
        try {
            // If the root was replaced, never delete through its new identity.
            validateRoot();
            Files.deleteIfExists(path);
        } catch (IOException | SecurityException | PrivateFileException ignored) {
            // A private orphan is safer than following a replaced root. It never confirms STORED.
        }
    }

    private static Path configuredPath(String value) {
        try {
            return Path.of(value);
        } catch (RuntimeException exception) {
            throw new PrivateFileException("Configuração inválida do armazenamento privado.");
        }
    }

    private static MessageDigest sha256Digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 não está disponível.");
        }
    }

    @FunctionalInterface
    interface AtomicMover {
        void move(Path source, Path target) throws IOException;
    }
}
