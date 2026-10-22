def test_login_and_proxy_attaches_token(client):
    r = client.post("/login", data={"account": "operator", "next": "/page/overview"}, follow_redirects=False)
    assert r.status_code == 303
    who = client.get("/whoami").json()
    assert who["role"] == "Operator" and who["logged_in"]
    r = client.get("/bff/api/v1/metadata")
    assert r.json()["auth"] == "Bearer tok-operator"   # token held server-side, attached by the BFF
    assert client.get("/bff/etc/passwd").status_code == 403


def test_unknown_account_rejected(client):
    assert client.post("/login", data={"account": "root"}).status_code == 400


def test_logout_clears(client):
    client.post("/login", data={"account": "viewer"})
    client.post("/logout", follow_redirects=False)
    assert client.get("/whoami").json()["logged_in"] is False
