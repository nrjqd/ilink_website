"""中文註解：後端測試案例，驗證 API、服務與安全設定的主要行為。"""

# test_health 將此步驟封裝成可測試的函式，讓路由、服務或腳本能重複使用同一套規則。
def test_health(client):
    # 詳細註解：此測試聚焦一個可觀察行為，透過明確輸入與斷言避免 API 或服務回歸。
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
