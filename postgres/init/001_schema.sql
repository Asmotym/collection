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
    musicbrainz_data JSONB
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
