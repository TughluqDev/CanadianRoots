from datetime import date, timedelta

from conftest import member, party_payload


def test_health_and_reference_data(client):
    assert client.get("/api/health").json() == {"status": "ok", "experiences": 10}
    prefs = client.get("/api/preferences").json()
    assert len(prefs["interests"]) == 20 and len(prefs["cultures"]) == 4
    assert {r["id"] for r in client.get("/api/regions").json()} == {
        "central", "atlantic", "prairies", "northern", "west_coast"}
    assert any(c["id"] == "toronto" for c in client.get("/api/cities").json())


def test_experience_endpoints(client):
    all_ = client.get("/api/experiences").json()
    assert len(all_) == 10
    july_central = client.get("/api/experiences", params={"region": "central", "month": 7}).json()
    assert {e["slug"] for e in july_central} == {
        "ottawa-indigenous-farm", "ottawa-ag-museum", "townships-cheese", "niagara-orchard"}
    assert client.get("/api/experiences/pei-village").json()["province"] == "PE"
    assert client.get("/api/experiences/nope").status_code == 404


def test_party_create_and_retrieve_with_multiple_members(client):
    payload = party_payload([
        member("Bob", ["indigenous"], ["cold_weather", "fishing"], "northern"),
        member("Sarah", ["french", "british"], ["cheese"]),
        member("Alex", ["british"], ["animals", "history"]),
    ])
    r = client.post("/api/parties", json=payload)
    assert r.status_code == 201
    party = client.get(f"/api/parties/{r.json()['id']}").json()
    assert party["starting_city"] == "Toronto" and party["origin_latitude"] == 43.6532
    names = [m["name"] for m in party["members"]]
    assert names == ["Bob", "Sarah", "Alex"]
    assert party["members"][0]["preferred_region"] == "northern"
    assert party["members"][1]["preferred_region"] is None
    assert party["members"][1]["cultures"] == ["french", "british"]
    assert party["members"][2]["interests"] == ["animals", "history"]


def test_party_update(client):
    pid = client.post("/api/parties", json=party_payload([member("A", ["french"])])).json()["id"]
    r = client.put(f"/api/parties/{pid}", json=party_payload(
        [member("A", ["french"]), member("B", ["british"])]))
    assert r.status_code == 200
    assert len(r.json()["members"]) == 2


def test_cultural_preference_required(client):
    r = client.post("/api/parties", json=party_payload([member("Bob", [])]))
    assert r.status_code == 422
    assert "Traveller 1" in r.json()["detail"]


def test_invalid_inputs_rejected(client):
    bad = [
        party_payload([member("Bob", ["martian"])]),
        party_payload([member("Bob", ["french"], ["skydiving"])]),
        party_payload([member("Bob", ["french"], region="mars")]),
        party_payload([member("  ", ["french"])]),
        party_payload([member("Bob", ["french"])], city="atlantis"),
        party_payload([]),
        {**party_payload([member("Bob", ["french"])]), "departure_month": None,
         "departure_date": str(date.today() - timedelta(days=3))},
    ]
    for p in bad:
        r = client.post("/api/parties", json=p)
        assert r.status_code == 422, p
        assert "Traceback" not in r.text


def test_departure_date_sets_month(client):
    d = date.today() + timedelta(days=40)
    p = {**party_payload([member("A", ["french"])]), "departure_month": None, "departure_date": str(d)}
    r = client.post("/api/parties", json=p)
    assert r.status_code == 201 and r.json()["departure_month"] == d.month


def test_large_party_supported(client, make_trip):
    members = [member(f"Traveller {i}", ["british"], ["history"]) for i in range(12)]
    trip = make_trip(members, city="ottawa")
    assert len(trip["recommendations"]) == 12
    assert trip["budget"]["travellers"] == 12


def test_generate_unknown_party_404(client):
    assert client.post("/api/trips/generate", json={"party_id": 999}).status_code == 404
    assert client.get("/api/trips/999").status_code == 404


def test_trip_reload_list_and_assumption_patch(client, make_trip):
    trip = make_trip([member("A", ["british"], ["animals"])], city="ottawa")
    again = client.get(f"/api/trips/{trip['id']}").json()
    assert again["stops"] == trip["stops"] and again["budget"] == trip["budget"]
    assert client.get("/api/trips").json()[0]["id"] == trip["id"]

    old_total = trip["budget"]["total"]
    r = client.patch(f"/api/trips/{trip['id']}/assumptions",
                     json={"nightly_room_rate": trip["assumptions"]["nightly_room_rate"] + 100})
    assert r.status_code == 200
    new = r.json()
    nights = new["budget"]["accommodation"]["nights"]
    expected_delta = 100 * nights * 1 * 1.15 * 1.10
    assert abs(new["budget"]["total"] - old_total - expected_delta) < 0.02
    assert client.get(f"/api/trips/{trip['id']}").json()["budget"]["total"] == new["budget"]["total"]
    assert client.patch(f"/api/trips/{trip['id']}/assumptions", json={"nightly_room_rate": -5}).status_code == 422
    assert client.patch(f"/api/trips/{trip['id']}/assumptions", json={"hack": 1}).status_code == 422

    assert client.delete(f"/api/trips/{trip['id']}").status_code == 204
    assert client.get(f"/api/trips/{trip['id']}").status_code == 404
