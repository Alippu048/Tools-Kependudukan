import hashlib
import unittest
from unittest.mock import patch

import mysql.connector

import app


class FakeCursor:
    def __init__(self, user):
        self.user = user
        self.parameters = None

    def execute(self, query, parameters):
        self.parameters = parameters

    def fetchone(self):
        return self.user

    def close(self):
        pass


class FakeConnection:
    def __init__(self, user):
        self.fake_cursor = FakeCursor(user)
        self.closed = False

    def cursor(self, dictionary=False):
        return self.fake_cursor

    def close(self):
        self.closed = True


class LoginTests(unittest.TestCase):
    def setUp(self):
        app.app.config["TESTING"] = True
        self.client = app.app.test_client()

    def sql_admin_user(self):
        return {
            "SIAK_USER": "admin",
            "SIAK_PASSWORD": hashlib.md5(b"admin").hexdigest(),
            "FULLNAME": "Ini Admin",
            "USER_LEVEL": 0,
        }

    def test_sql_example_account_can_login(self):
        connection = FakeConnection(self.sql_admin_user())
        with patch.object(app, "get_mysql_connection", return_value=connection):
            response = self.client.post(
                "/login",
                data={"username": "admin", "password": "admin"},
            )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/home")
        self.assertTrue(connection.closed)
        with self.client.session_transaction() as login_session:
            self.assertEqual(login_session["username"], "admin")
            self.assertEqual(login_session["fullname"], "Ini Admin")

    def test_invalid_password_is_rejected(self):
        connection = FakeConnection(self.sql_admin_user())
        with patch.object(app, "get_mysql_connection", return_value=connection):
            response = self.client.post(
                "/login",
                data={"username": "admin", "password": "wrong"},
            )

        self.assertEqual(response.status_code, 401)
        self.assertTrue(connection.closed)

    def test_admin_pages_require_login_but_guest_page_is_public(self):
        protected_response = self.client.get("/upload")
        guest_response = self.client.get("/penyajian_guest")

        self.assertEqual(protected_response.status_code, 302)
        self.assertIn("/admin/login", protected_response.headers["Location"])
        self.assertEqual(guest_response.status_code, 200)

    def test_database_error_returns_service_unavailable(self):
        with patch.object(
            app,
            "get_mysql_connection",
            side_effect=mysql.connector.Error("database unavailable"),
        ):
            response = self.client.post(
                "/login",
                data={"username": "admin", "password": "admin"},
            )

        self.assertEqual(response.status_code, 503)


if __name__ == "__main__":
    unittest.main()