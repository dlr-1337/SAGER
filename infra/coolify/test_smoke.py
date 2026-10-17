"""Check the smoke's authentication contract without Docker or real credentials."""

import io
from pathlib import Path
import shlex
import tempfile
import unittest
from unittest.mock import Mock, call, patch
from urllib.parse import parse_qs

from smoke import Smoke, SmokeError


class AccountContractTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='sager-smoke-contract-')
        self.addCleanup(self.directory.cleanup)
        self.smoke = Smoke.__new__(Smoke)
        self.smoke.temporary = Path(self.directory.name)
        self.smoke.env = {}
        self.smoke.compose = lambda *args: ['docker', 'compose', *args]

    def create(self, *, echo=False, exit_code=0):
        password = 'Smk!' + 'a' * 40
        output = b'Senha local: Confirme a senha: Conta local criada.'
        if echo:
            output += password.encode('ascii')
        process = Mock(stdout=io.BytesIO(output))
        process.wait.return_value = exit_code
        process.poll.return_value = exit_code
        with patch('smoke.subprocess.Popen', return_value=process) as popen, \
                patch('smoke.secrets.token_hex', return_value='a' * 40):
            self.smoke.create_account()
        return popen.call_args.args[0], process

    def test_cli_provisions_enrollment_and_sends_password_only_to_private_stdin(self):
        command, process = self.create()
        java = command[command.index('--command') + 1]
        options = shlex.split(java)
        self.assertIn('--matricula=' + self.smoke.enrollment, options)
        self.assertTrue(self.smoke.enrollment)
        self.assertIn('--email=' + self.smoke.email, options)
        self.assertIn('--echo=never', command)
        self.assertNotIn(self.smoke.password, java)
        process.stdin.write.assert_has_calls([
            call((self.smoke.password + '\n').encode('ascii')),
            call((self.smoke.password + '\n').encode('ascii')),
        ])
        self.assertNotIn(self.smoke.password.encode('ascii'),
                         (self.smoke.temporary / 'account-cli.log').read_bytes())

    def test_login_uses_enrollment_and_preserves_csrf_and_forwarding_test_headers(self):
        self.smoke.enrollment = 'TESTE-SMOKE-001'
        self.smoke.email = 'contact@example.invalid'
        self.smoke.request = Mock(return_value=(b'', {}))
        token = {'headerName': 'X-CSRF-TOKEN', 'token': 'synthetic-token'}
        self.smoke.login(token, 'synthetic-password', 204, {'X-Forwarded-For': '203.0.113.77'})
        args, kwargs = self.smoke.request.call_args
        self.assertEqual(args, ('/api/v1/auth/login', 204))
        self.assertEqual(kwargs['method'], 'POST')
        self.assertEqual(parse_qs(kwargs['body']), {
            'matricula': ['TESTE-SMOKE-001'], 'password': ['synthetic-password'],
        })
        self.assertEqual(kwargs['headers'], {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRF-TOKEN': 'synthetic-token', 'X-Forwarded-For': '203.0.113.77',
        })

    def test_cli_rejects_password_echo(self):
        with self.assertRaisesRegex(SmokeError, 'must not echo passwords'):
            self.create(echo=True)

    def test_cli_rejects_unsuccessful_provisioning(self):
        with self.assertRaisesRegex(SmokeError, 'did not succeed'):
            self.create(exit_code=2)


if __name__ == '__main__':
    unittest.main()
