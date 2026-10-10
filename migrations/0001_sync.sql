-- Encrypted sync vaults. The server only ever sees: a random vault id, a hash
-- of the paired devices' access token, opaque item ids, timestamps, sizes and
-- scrambled blobs. It cannot read any museum content.
CREATE TABLE IF NOT EXISTS vaults (
  id TEXT PRIMARY KEY,
  auth TEXT NOT NULL,
  rev INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
  vault TEXT NOT NULL,
  id TEXT NOT NULL,
  updated INTEGER NOT NULL,
  rev INTEGER NOT NULL,
  blob TEXT NOT NULL,
  PRIMARY KEY (vault, id)
);
CREATE INDEX IF NOT EXISTS items_by_rev ON items (vault, rev);
CREATE TRIGGER IF NOT EXISTS items_bytes_insert AFTER INSERT ON items BEGIN
  UPDATE vaults SET bytes = bytes + length(NEW.blob) WHERE id = NEW.vault;
END;
CREATE TRIGGER IF NOT EXISTS items_bytes_update AFTER UPDATE OF blob ON items BEGIN
  UPDATE vaults SET bytes = bytes + length(NEW.blob) - length(OLD.blob) WHERE id = NEW.vault;
END;
CREATE TRIGGER IF NOT EXISTS vault_delete AFTER DELETE ON vaults BEGIN
  DELETE FROM items WHERE vault = OLD.id;
END;
