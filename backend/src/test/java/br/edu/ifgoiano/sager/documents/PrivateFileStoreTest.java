package br.edu.ifgoiano.sager.documents;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PrivateFileStoreTest {
    @TempDir
    Path temporaryDirectory;

    @Test
    void storesExactReceivedBytesWithIndependentHashAndOnlyUuidPath() throws Exception {
        Path root = temporaryDirectory.resolve("private");
        PrivateFileStore store = new PrivateFileStore(root, 1024);
        byte[] bytes = "PDF assinado recebido com acentuação".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        UUID id = UUID.randomUUID();

        StoredFile stored = store.storeImmutable(id, new ByteArrayInputStream(bytes));

        assertThat(stored).isEqualTo(new StoredFile(id, sha256(bytes), bytes.length, "STORED"));
        assertThat(store.openVerified(stored)).isEqualTo(bytes);
        try (var entries = Files.list(root)) {
            assertThat(entries.map(path -> path.getFileName().toString()).toList())
                    .containsExactly(id.toString());
        }
    }

    @Test
    void acceptsTheSizeLimitAndRejectsOneByteBeyondWithoutConfirmingOrLeavingAFile() throws Exception {
        Path root = temporaryDirectory.resolve("private");
        PrivateFileStore store = new PrivateFileStore(root, 4);
        StoredFile stored = store.storeImmutable(UUID.randomUUID(), new ByteArrayInputStream(new byte[4]));
        UUID rejected = UUID.randomUUID();

        assertThat(store.openVerified(stored)).hasSize(4);
        assertThatThrownBy(() -> store.storeImmutable(rejected, new ByteArrayInputStream(new byte[5])))
                .isInstanceOf(PrivateFileException.class).hasMessageNotContaining(root.toString());
        assertThat(Files.exists(root.resolve(rejected.toString()))).isFalse();
        try (var entries = Files.list(root)) {
            assertThat(entries.toList()).hasSize(1);
        }
    }

    @Test
    void aFailedAtomicMoveNeverReturnsStoredOrLeavesTemporaryBytes() throws Exception {
        Path root = temporaryDirectory.resolve("private");
        PrivateFileStore store = new PrivateFileStore(root, 1024, (source, target) -> {
            throw new AtomicMoveNotSupportedException(source.toString(), target.toString(), "synthetic");
        });

        assertThatThrownBy(() -> store.storeImmutable(UUID.randomUUID(), new ByteArrayInputStream(new byte[4])))
                .isInstanceOf(PrivateFileException.class)
                .hasMessageNotContaining(root.toString()).hasMessageNotContaining("synthetic");
        try (var entries = Files.list(root)) {
            assertThat(entries.toList()).isEmpty();
        }
    }

    @Test
    void closesTheTemporaryOutputBeforeAtomicMove() throws Exception {
        Path root = temporaryDirectory.resolve("private");
        byte[] bytes = {1, 2, 3, 4};
        PrivateFileStore store = new PrivateFileStore(root, 1024, (source, target) -> {
            assertThat(Files.readAllBytes(source)).isEqualTo(bytes);
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
        });

        assertThat(store.openVerified(store.storeImmutable(UUID.randomUUID(), new ByteArrayInputStream(bytes))))
                .isEqualTo(bytes);
    }

    @Test
    void interruptedInputDoesNotLeaveAPartialFile() throws Exception {
        Path root = temporaryDirectory.resolve("private");
        PrivateFileStore store = new PrivateFileStore(root, 1024);
        InputStream broken = new InputStream() {
            private int count;
            @Override
            public int read() throws IOException {
                if (count >= 3) {
                    throw new IOException("synthetic private path must not escape");
                }
                count++;
                return 42;
            }
        };

        assertThatThrownBy(() -> store.storeImmutable(UUID.randomUUID(), broken))
                .isInstanceOf(PrivateFileException.class).hasMessageNotContaining("synthetic");
        try (var entries = Files.list(root)) {
            assertThat(entries.toList()).isEmpty();
        }
    }

    @Test
    void anExistingUuidIsImmutable() throws Exception {
        Path root = temporaryDirectory.resolve("private");
        PrivateFileStore store = new PrivateFileStore(root, 1024);
        UUID id = UUID.randomUUID();
        StoredFile original = store.storeImmutable(id, new ByteArrayInputStream(new byte[] {1, 2}));

        assertThatThrownBy(() -> store.storeImmutable(id, new ByteArrayInputStream(new byte[] {3, 4})))
                .isInstanceOf(PrivateFileException.class);
        assertThat(store.openVerified(original)).containsExactly((byte) 1, (byte) 2);
    }

    @Test
    void anotherStoreInstanceCannotOverwriteTheSameUuidDuringItsAtomicMove() throws Exception {
        Path root = temporaryDirectory.resolve("private");
        CountDownLatch moving = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        PrivateFileStore first = new PrivateFileStore(root, 1024, (source, target) -> {
            moving.countDown();
            try {
                if (!release.await(5, TimeUnit.SECONDS)) {
                    throw new IOException("Move was not released");
                }
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IOException("Move was interrupted");
            }
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
        });
        PrivateFileStore second = new PrivateFileStore(root, 1024);
        UUID id = UUID.randomUUID();
        var worker = Executors.newSingleThreadExecutor();
        try {
            var result = worker.submit(() -> first.storeImmutable(id, new ByteArrayInputStream(new byte[] {1, 2})));
            assertThat(moving.await(5, TimeUnit.SECONDS)).isTrue();
            assertThatThrownBy(() -> second.storeImmutable(id, new ByteArrayInputStream(new byte[] {3, 4})))
                    .isInstanceOf(PrivateFileException.class);
            release.countDown();
            StoredFile original = result.get(5, TimeUnit.SECONDS);
            assertThat(second.openVerified(original)).containsExactly((byte) 1, (byte) 2);
            try (var entries = Files.list(root)) {
                assertThat(entries.map(path -> path.getFileName().toString()).toList()).containsExactly(id.toString());
            }
        } finally {
            release.countDown();
            worker.shutdownNow();
        }
    }

    @Test
    void corruptionAfterAMoveCannotConfirmStored() throws Exception {
        Path root = temporaryDirectory.resolve("private");
        UUID id = UUID.randomUUID();
        PrivateFileStore store = new PrivateFileStore(root, 1024, (source, target) -> {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
            Files.write(target, new byte[] {3, 2, 1});
        });

        assertThatThrownBy(() -> store.storeImmutable(id, new ByteArrayInputStream(new byte[] {1, 2, 3})))
                .isInstanceOf(PrivateFileException.class);
        assertThatThrownBy(() -> store.openVerified(new StoredFile(id, sha256(new byte[] {1, 2, 3}), 3, "STORED")))
                .isInstanceOf(PrivateFileException.class);
        try (var entries = Files.list(root)) {
            // This private orphan is unconfirmed and cannot pass its persisted digest.
            assertThat(entries.map(path -> path.getFileName().toString()).toList()).containsExactly(id.toString());
        }
    }

    @Test
    void missingTruncatedExpandedAndSameLengthCorruptedFilesFailClosed() throws Exception {
        Path root = temporaryDirectory.resolve("private");
        PrivateFileStore store = new PrivateFileStore(root, 1024);
        StoredFile stored = store.storeImmutable(UUID.randomUUID(), new ByteArrayInputStream(new byte[] {1, 2, 3}));
        Path path = root.resolve(stored.id().toString());

        Files.write(path, new byte[] {1, 2});
        assertThatThrownBy(() -> store.openVerified(stored)).isInstanceOf(PrivateFileException.class);
        Files.write(path, new byte[] {1, 2, 3, 4});
        assertThatThrownBy(() -> store.openVerified(stored)).isInstanceOf(PrivateFileException.class);
        Files.write(path, new byte[] {3, 2, 1});
        assertThatThrownBy(() -> store.openVerified(stored)).isInstanceOf(PrivateFileException.class);
        Files.delete(path);
        assertThatThrownBy(() -> store.openVerified(stored)).isInstanceOf(PrivateFileException.class);
    }

    @Test
    void unconfirmedInvalidHashAndOversizeMetadataCannotBeRead() throws Exception {
        PrivateFileStore store = new PrivateFileStore(temporaryDirectory.resolve("private"), 1024);
        StoredFile stored = store.storeImmutable(UUID.randomUUID(), new ByteArrayInputStream(new byte[] {1}));

        assertThatThrownBy(() -> store.openVerified(new StoredFile(stored.id(), stored.sha256(), 1, "PENDING")))
                .isInstanceOf(PrivateFileException.class);
        assertThatThrownBy(() -> store.openVerified(new StoredFile(stored.id(), "bad", 1, "STORED")))
                .isInstanceOf(PrivateFileException.class);
        assertThatThrownBy(() -> store.openVerified(new StoredFile(stored.id(), stored.sha256(), 1025, "STORED")))
                .isInstanceOf(PrivateFileException.class);
    }

    @Test
    void rejectsPublicRootsAndConfiguredTraversalBeforeCreatingDirectories() {
        assertThatThrownBy(() -> new PrivateFileStore(temporaryDirectory.resolve("frontend/public/pdfs"), 1024))
                .isInstanceOf(PrivateFileException.class);
        assertThatThrownBy(() -> new PrivateFileStore(temporaryDirectory.resolve("private/../elsewhere"), 1024))
                .isInstanceOf(PrivateFileException.class);
        assertThat(Files.exists(temporaryDirectory.resolve("frontend"))).isFalse();
    }

    @Test
    void rejectsSymlinkAncestorsAndAFileSymlinkEvenIfBytesAndHashMatch() throws Exception {
        Path actual = Files.createDirectory(temporaryDirectory.resolve("actual"));
        Path link = temporaryDirectory.resolve("link");
        createLinkOrSkip(link, actual);
        assertThatThrownBy(() -> new PrivateFileStore(link.resolve("private"), 1024))
                .isInstanceOf(PrivateFileException.class);

        Path root = temporaryDirectory.resolve("private");
        PrivateFileStore store = new PrivateFileStore(root, 1024);
        byte[] bytes = {1, 2, 3};
        Path external = Files.write(actual.resolve("external"), bytes);
        UUID id = UUID.randomUUID();
        Files.createSymbolicLink(root.resolve(id.toString()), external);
        assertThatThrownBy(() -> store.openVerified(new StoredFile(id, sha256(bytes), bytes.length, "STORED")))
                .isInstanceOf(PrivateFileException.class);
        assertThatThrownBy(() -> store.storeImmutable(id, new ByteArrayInputStream(bytes)))
                .isInstanceOf(PrivateFileException.class);
        assertThat(Files.readAllBytes(external)).isEqualTo(bytes);
    }

    @Test
    void replacingTheValidatedRootWithASymlinkFailsClosed() throws Exception {
        Path root = temporaryDirectory.resolve("private");
        PrivateFileStore store = new PrivateFileStore(root, 1024);
        Path external = Files.createDirectory(temporaryDirectory.resolve("external"));
        Files.delete(root);
        createLinkOrSkip(root, external);

        assertThatThrownBy(() -> store.storeImmutable(UUID.randomUUID(), new ByteArrayInputStream(new byte[1])))
                .isInstanceOf(PrivateFileException.class);
        try (var entries = Files.list(external)) {
            assertThat(entries.toList()).isEmpty();
        }
    }

    @Test
    void replacingTheValidatedRootWithAnotherRegularDirectoryFailsClosed() throws Exception {
        Path root = temporaryDirectory.resolve("private");
        PrivateFileStore store = new PrivateFileStore(root, 1024);
        Files.move(root, temporaryDirectory.resolve("original-root"));
        Files.createDirectory(root);

        assertThatThrownBy(() -> store.storeImmutable(UUID.randomUUID(), new ByteArrayInputStream(new byte[1])))
                .isInstanceOf(PrivateFileException.class);
        try (var entries = Files.list(root)) {
            assertThat(entries.toList()).isEmpty();
        }
    }

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private static void createLinkOrSkip(Path link, Path target) throws IOException {
        try {
            Files.createSymbolicLink(link, target);
        } catch (IOException | UnsupportedOperationException exception) {
            assumeTrue(false, "The operating system does not allow symlink creation: " + exception.getClass().getSimpleName());
        }
    }
}
