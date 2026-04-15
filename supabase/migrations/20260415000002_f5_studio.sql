-- ============================================================
-- F5 — AI Avatar Studio
-- HeyGen + ElevenLabs + Remotion + Timeline Editor
-- ============================================================

-- ── Projects ─────────────────────────────────────────────────────────────

CREATE TABLE studio_projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           text NOT NULL DEFAULT 'Nouveau projet',
  input_type      text NOT NULL CHECK (input_type IN ('script', 'youtube_url')),
  input_value     text NOT NULL,
  input_language  text NOT NULL DEFAULT 'fr',
  original_script text,
  improved_script text,
  avatar_id       text,
  voice_id        text,
  format          text NOT NULL DEFAULT '16_9'
                  CHECK (format IN ('16_9', '9_16', 'both')),
  background_color text DEFAULT '#0D1117',
  music_track     text,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN (
                    'draft', 'analyzing', 'generating', 'editing',
                    'rendering', 'done', 'error'
                  )),
  final_video_url      text,
  final_video_9_16_url text,
  total_duration       integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Scenes ───────────────────────────────────────────────────────────────

CREATE TABLE studio_scenes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id),
  index           integer NOT NULL,
  type            text NOT NULL
                  CHECK (type IN (
                    'avatar', 'split', 'infographic',
                    'demo', 'typography', 'broll'
                  )),
  script          text NOT NULL,
  duration_est    integer,
  duration_actual integer,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN (
                    'pending', 'generating', 'done', 'error',
                    'regenerating', 'outdated'
                  )),
  video_url       text,
  audio_url       text,
  thumbnail_url   text,
  heygen_video_id text,
  remotion_params jsonb,
  broll_query     text,
  pexels_video_url text,
  previous_versions jsonb DEFAULT '[]'::jsonb,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX idx_studio_scenes_order
  ON studio_scenes(project_id, index);
CREATE INDEX idx_studio_scenes_project
  ON studio_scenes(project_id);
CREATE INDEX idx_studio_projects_user
  ON studio_projects(user_id);
CREATE INDEX idx_studio_projects_status
  ON studio_projects(status);
CREATE INDEX idx_studio_scenes_heygen
  ON studio_scenes(heygen_video_id) WHERE heygen_video_id IS NOT NULL;

-- ── updated_at trigger ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_studio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER studio_projects_updated_at
  BEFORE UPDATE ON studio_projects
  FOR EACH ROW EXECUTE FUNCTION update_studio_updated_at();

CREATE TRIGGER studio_scenes_updated_at
  BEFORE UPDATE ON studio_scenes
  FOR EACH ROW EXECUTE FUNCTION update_studio_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE studio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_scenes   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their studio projects"
  ON studio_projects FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users own their studio scenes"
  ON studio_scenes FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Realtime ─────────────────────────────────────────────────────────────
-- Enable Supabase Realtime for scene status updates

ALTER PUBLICATION supabase_realtime ADD TABLE studio_scenes;
ALTER PUBLICATION supabase_realtime ADD TABLE studio_projects;
