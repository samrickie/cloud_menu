CREATE TABLE venue_online_menu (
 venue_id uuid PRIMARY KEY REFERENCES venues(id),
 share_id uuid NOT NULL UNIQUE,
 enabled boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1 CHECK (revision > 0)
);
