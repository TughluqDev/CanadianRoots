import copy

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app import config
from app.models import Experience, ExperienceCulture, ExperienceSource, ExperienceTag
from app.seed import DatasetIn, load_dataset, seed
from conftest import FIXTURE


def counts(session):
    return tuple(session.scalar(select(func.count()).select_from(m))
                 for m in (Experience, ExperienceTag, ExperienceCulture, ExperienceSource))


def test_seed_is_idempotent(session, tmp_path):
    before = counts(session)
    result = seed(session, DatasetIn.model_validate(FIXTURE), image_dir=tmp_path)
    assert result["created"] == 0 and result["updated"] == 10
    assert counts(session) == before


def test_seed_updates_and_removes(session, tmp_path):
    data = copy.deepcopy(FIXTURE)
    data["experiences"][0]["tags"] = ["farming"]
    data["experiences"].pop()
    result = seed(session, DatasetIn.model_validate(data), image_dir=tmp_path)
    assert result["removed"] == 1
    exp = session.scalar(select(Experience).where(Experience.slug == "ottawa-indigenous-farm"))
    assert exp.tag_ids == ["farming"]


def test_local_image_preferred(session, tmp_path):
    data = copy.deepcopy(FIXTURE)
    data["experiences"][0]["image"] = {"url": "https://upload.wikimedia.org/x.jpg", "license": "CC BY 4.0"}
    (tmp_path / "ottawa-indigenous-farm.jpg").write_bytes(b"x")
    seed(session, DatasetIn.model_validate(data), image_dir=tmp_path)
    exp = session.scalar(select(Experience).where(Experience.slug == "ottawa-indigenous-farm"))
    assert exp.image_url == "/images/experiences/ottawa-indigenous-farm.jpg"


@pytest.mark.parametrize("mutate", [
    lambda r: r.update(region="prairies"),
    lambda r: r.update(tags=["not_a_tag"]),
    lambda r: r.update(pricing={"status": "verified", "adult_price_cad": 5}),
    lambda r: r.update(sources=[]),
    lambda r: r.update(available_months=[13]),
    lambda r: r.update(latitude=10.0),
])
def test_validation_rejects_bad_records(mutate):
    data = copy.deepcopy(FIXTURE)
    mutate(data["experiences"][0])
    with pytest.raises(ValidationError):
        DatasetIn.model_validate(data)


@pytest.mark.skipif(not config.DATA_FILE.exists(), reason="research dataset not present")
def test_real_dataset_is_valid():
    ds = load_dataset()
    assert len(ds.experiences) >= 15
    assert {e.region for e in ds.experiences} >= {"central", "atlantic", "prairies", "west_coast"}
    assert {c for e in ds.experiences for c in e.cultures} == {"indigenous", "british", "french", "immigrant"}
    for e in ds.experiences:
        assert e.sources and e.website and e.available_months
