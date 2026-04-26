-- user_roles
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('student', 'parent', 'org_staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_own_select" ON user_roles;
CREATE POLICY "user_roles_own_select" ON user_roles FOR SELECT USING (auth.uid() = user_id);

-- parent_links
CREATE TABLE IF NOT EXISTS parent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  invited_email text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE parent_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "parent_links_own_select" ON parent_links;
CREATE POLICY "parent_links_own_select" ON parent_links FOR SELECT USING (auth.uid() = parent_user_id);
DROP POLICY IF EXISTS "parent_links_own_insert" ON parent_links;
CREATE POLICY "parent_links_own_insert" ON parent_links FOR INSERT WITH CHECK (auth.uid() = parent_user_id);
DROP POLICY IF EXISTS "parent_links_own_update" ON parent_links;
CREATE POLICY "parent_links_own_update" ON parent_links FOR UPDATE USING (auth.uid() = parent_user_id);

-- organizations (RLS policy は organization_members 作成後)
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'cram_school' CHECK (type IN ('cram_school', 'school')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- organization_members
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "organization_members_own_select" ON organization_members;
CREATE POLICY "organization_members_own_select" ON organization_members FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "organizations_member_select" ON organizations;
CREATE POLICY "organizations_member_select" ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

-- organization_students
CREATE TABLE IF NOT EXISTS organization_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, student_id)
);
ALTER TABLE organization_students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "organization_students_member_select" ON organization_students;
CREATE POLICY "organization_students_member_select" ON organization_students FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

-- parent_notes
CREATE TABLE IF NOT EXISTS parent_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  note text,
  preferred_subjects text[],
  preferred_weekday_minutes integer,
  preferred_holiday_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parent_user_id, student_id)
);
ALTER TABLE parent_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "parent_notes_own_all" ON parent_notes;
CREATE POLICY "parent_notes_own_all" ON parent_notes FOR ALL USING (auth.uid() = parent_user_id);

-- staff_notes
CREATE TABLE IF NOT EXISTS staff_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE staff_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_notes_member_select" ON staff_notes;
CREATE POLICY "staff_notes_member_select" ON staff_notes FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "staff_notes_member_insert" ON staff_notes;
CREATE POLICY "staff_notes_member_insert" ON staff_notes FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    AND auth.uid() = author_user_id
  );
DROP POLICY IF EXISTS "staff_notes_author_update" ON staff_notes;
CREATE POLICY "staff_notes_author_update" ON staff_notes FOR UPDATE
  USING (auth.uid() = author_user_id);
