CREATE TABLE IF NOT EXISTS artist (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    image TEXT,
    musicbrainz_data JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS artist_musicbrainz_id_unique_idx
ON artist ((musicbrainz_data->>'id'))
WHERE musicbrainz_data->>'id' IS NOT NULL;

CREATE TABLE IF NOT EXISTS album (
    id SERIAL PRIMARY KEY,
    artist_id INTEGER NOT NULL REFERENCES artist(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    year INTEGER,
    image TEXT,
    image_data BYTEA,
    image_mime_type TEXT,
    musicbrainz_data JSONB,
    image_source TEXT NOT NULL DEFAULT 'manual' CHECK (image_source IN ('manual', 'cover-art-archive', 'discogs', 'fanart')),
    image_reference JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS album_musicbrainz_id_unique_idx
ON album ((musicbrainz_data->>'id'))
WHERE musicbrainz_data->>'id' IS NOT NULL;

CREATE TABLE IF NOT EXISTS users (
    discord_user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar TEXT,
    rights TEXT NOT NULL DEFAULT 'user' CHECK (rights IN ('user', 'admin'))
);

CREATE TABLE IF NOT EXISTS collection (
    id SERIAL PRIMARY KEY,
    artist_id INTEGER NOT NULL REFERENCES artist(id) ON DELETE CASCADE,
    album_id INTEGER NOT NULL REFERENCES album(id) ON DELETE CASCADE,
    created_by_user_id TEXT REFERENCES users(discord_user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
    musicbrainz_release_data JSONB,
    UNIQUE (album_id, created_by_user_id)
);

CREATE TABLE IF NOT EXISTS category (
    id SERIAL PRIMARY KEY,
    created_by_user_id TEXT NOT NULL REFERENCES users(discord_user_id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES category(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
    position INTEGER NOT NULL CHECK (position >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS category_root_name_unique_idx
ON category (created_by_user_id, lower(name)) WHERE parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS category_child_name_unique_idx
ON category (parent_id, lower(name)) WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS category_user_parent_position_idx
ON category (created_by_user_id, parent_id, position, id);

CREATE TABLE IF NOT EXISTS collection_category (
    collection_id INTEGER NOT NULL REFERENCES collection(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES category(id) ON DELETE CASCADE,
    PRIMARY KEY (collection_id, category_id)
);

CREATE TABLE IF NOT EXISTS artist_external_reference (
    artist_id INTEGER NOT NULL REFERENCES artist(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('musicbrainz', 'discogs', 'lastfm')),
    entity_kind TEXT NOT NULL DEFAULT 'artist',
    external_id TEXT NOT NULL,
    external_url TEXT NOT NULL,
    PRIMARY KEY (provider, entity_kind, external_id),
    UNIQUE (artist_id, provider, entity_kind)
);

CREATE TABLE IF NOT EXISTS album_external_reference (
    album_id INTEGER NOT NULL REFERENCES album(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('musicbrainz', 'discogs', 'lastfm')),
    entity_kind TEXT NOT NULL,
    external_id TEXT NOT NULL,
    external_url TEXT NOT NULL,
    PRIMARY KEY (provider, entity_kind, external_id),
    UNIQUE (album_id, provider, entity_kind)
);
