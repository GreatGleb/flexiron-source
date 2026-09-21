"""Tenant isolation of the actual auth consumers, using the shared SQL fixture."""

from sqlalchemy import select

from tests.modules.auth.test_current_user import AuthDatabaseCase, Currency, UploadedFile, User
from app.modules.auth.shared.session_tokens import issue_session_token


class AuthConsumersTest(AuthDatabaseCase):
    async def test_settings_and_profile_use_identity_company(self):
        for user, currency, name in ((self.user_a, self.currency_a, "A"), (self.user_b, self.currency_b, "B")):
            token = issue_session_token(user)
            response = await self.request_consumer("settings", "Bearer " + token)
            self.assertEqual(200, response.status_code, response.text)
            self.assertEqual([str(currency)], [row["id"] for row in response.json()["data"]])
            response = await self.request_consumer("profile", "Bearer " + token)
            self.assertEqual(200, response.status_code, response.text)
            self.assertEqual(name, response.json()["data"]["firstName"])

    async def test_foreign_currency_patch_delete_are_404_and_do_not_write(self):
        for method in ("PATCH", "DELETE"):
            self.statements.clear()
            response = await self.client.request(method, f"/api/settings/currencies/{self.currency_b}",
                headers={"Authorization": "Bearer " + self.token, "X-Tenant-ID": str(self.tenant_b)},
                params={"tenant_id": str(self.tenant_b)},
                **({"json": {"exchangeRate": 2, "tenant_id": str(self.tenant_b)}} if method == "PATCH" else {}))
            self.assertEqual(404, response.status_code, response.text)
            self.assertEqual("NOT_FOUND", response.json()["detail"]["code"])
            self.assertFalse(any(sql.lstrip().upper().startswith(("UPDATE", "DELETE")) for sql in self.statements))
            async with self.sessions() as db:
                row = await db.get(Currency, self.currency_b)
                self.assertIsNotNone(row)
                self.assertEqual(self.tenant_b, row.tenant_id)
                self.assertEqual(1, row.exchange_rate)
                self.assertEqual({"en": "B dollar"}, row.name_translations)

    async def test_own_currency_and_profile_patch_ignore_body_tenant(self):
        headers = {"Authorization": "Bearer " + self.token, "X-Tenant-ID": str(self.tenant_b)}
        response = await self.client.patch(f"/api/settings/currencies/{self.currency_a}", headers=headers,
            json={"exchangeRate": 2, "tenant_id": str(self.tenant_b)})
        self.assertEqual(200, response.status_code, response.text)
        response = await self.client.patch("/api/settings/profile", headers=headers,
            json={"firstName": "Changed A", "tenant_id": str(self.tenant_b), "user_id": str(self.user_b)})
        self.assertEqual(200, response.status_code, response.text)
        async with self.sessions() as db:
            self.assertEqual(2, (await db.get(Currency, self.currency_a)).exchange_rate)
            self.assertEqual(self.tenant_a, (await db.get(Currency, self.currency_a)).tenant_id)
            self.assertEqual("Changed A", (await db.get(User, self.user_a)).first_name)
            self.assertEqual("B", (await db.get(User, self.user_b)).first_name)

    async def test_upload_ignores_spoofed_tenant_and_stores_only_for_a(self):
        response = await self.request_consumer("upload", "Bearer " + self.token)
        self.assertEqual(200, response.status_code, response.text)
        async with self.sessions() as db:
            rows = (await db.execute(select(UploadedFile))).scalars().all()
            self.assertEqual(1, len(rows))
            self.assertEqual(str(rows[0].id), response.json()["data"]["fileId"])
            self.assertEqual(self.tenant_a, rows[0].tenant_id)
            self.assertEqual(self.user_a, rows[0].uploaded_by)
        files = list(self.files.iterdir())
        self.assertEqual(1, len(files))
        self.assertEqual(b"tenant A data", files[0].read_bytes())


    async def test_currency_writers_scope_their_own_sql(self):
        from app.modules.settings.features.crud.repository import patch_currency, delete_currency
        async with self.sessions() as db:
            self.assertIsNone(await patch_currency(db, self.currency_b, self.tenant_a, {"exchange_rate": 9}))
            await delete_currency(db, self.currency_b, self.tenant_a)
        async with self.sessions() as db:
            foreign = await db.get(Currency, self.currency_b)
            self.assertIsNotNone(foreign)
            self.assertEqual(1, foreign.exchange_rate)
            self.assertEqual(self.tenant_b, foreign.tenant_id)
