CREATE TABLE sager_resident (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    enrollment VARCHAR(64) NOT NULL,
    birth_date DATE,
    course VARCHAR(200),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sager_resident_name_valid
        CHECK (LENGTH(name) BETWEEN 3 AND 200 AND name = BTRIM(name)),
    CONSTRAINT sager_resident_enrollment_valid
        CHECK (LENGTH(enrollment) BETWEEN 1 AND 64 AND enrollment = BTRIM(enrollment)),
    CONSTRAINT sager_resident_course_valid
        CHECK (course IS NULL OR (LENGTH(course) BETWEEN 1 AND 200 AND course = BTRIM(course))),
    CONSTRAINT sager_resident_version_nonnegative CHECK (version >= 0)
);

CREATE UNIQUE INDEX sager_resident_enrollment_unique ON sager_resident (LOWER(enrollment));
