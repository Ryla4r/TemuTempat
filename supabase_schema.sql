-- ==========================================
-- QUICK FIX: Jika muncul error "row-level security policy", 
-- jalankan salah satu perintah ini di Supabase SQL Editor:
-- ==========================================
-- (A) NUCLEAR OPTION (Matikan RLS - Paling Cepat):
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE places DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE bookmarks DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE trending_hashtags DISABLE ROW LEVEL SECURITY;
--
-- (B) SECURE OPTION (Jalankan policy di bagian bawah file ini)
-- ==========================================

-- 1. Tabel Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user',
  avatar TEXT,
  bio TEXT,
  phone TEXT,
  last_seen_at TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Mandatory System User to avoid FK violations
INSERT INTO users (id, email, name, role, avatar)
VALUES ('00000000-0000-0000-0000-000000000000', 'system@temutempat.id', 'Arsiparis Pusat', 'admin', 'https://api.dicebear.com/7.x/initials/svg?seed=Arsiparis')
ON CONFLICT (id) DO NOTHING;

-- 2. Tabel Places
CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category JSONB, -- Simpan sebagai array JSON
  address TEXT,
  image_url TEXT,
  rating REAL DEFAULT 0,
  latitude REAL,
  longitude REAL,
  price_level INTEGER,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_featured BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT,
  user_avatar TEXT,
  rating INTEGER,
  comment TEXT,
  likes INTEGER DEFAULT 0,
  replies JSONB DEFAULT '[]',
  media_url TEXT,
  hashtags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabel Bookmarks (Favorit)
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, place_id)
);

-- 5. Tabel Trending Hashtags
CREATE TABLE IF NOT EXISTS trending_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  updates_count INTEGER DEFAULT 0
);

-- 6. Tabel Communities
CREATE TABLE IF NOT EXISTS communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  member_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabel Group Members
CREATE TABLE IF NOT EXISTS group_members (
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);

-- 8. Tabel Messages (Chat)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tabel Community Explorations (History of places visited)
CREATE TABLE IF NOT EXISTS community_explorations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  notes TEXT,
  explored_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Tabel User Views (History of unique places viewed)
CREATE TABLE IF NOT EXISTS user_views (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, place_id)
);

-- 11. Tabel Website Ratings
CREATE TABLE IF NOT EXISTS website_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Tabel User Posts (Travel Feed)
CREATE TABLE IF NOT EXISTS user_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  username TEXT,
  media_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Tabel Post Likes
CREATE TABLE IF NOT EXISTS post_likes (
  id BIGSERIAL PRIMARY KEY,
  post_id UUID REFERENCES user_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  unique(post_id, user_id)
);

-- 14. Tabel Post Comments
CREATE TABLE IF NOT EXISTS post_comments (
  id BIGSERIAL PRIMARY KEY,
  post_id UUID REFERENCES user_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  username TEXT,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Setup Storage Buckets (travel_media)
-- Note: This might require manual execution in Supabase Dashboard if the storage schema is not accessible via SQL.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('travel_media', 'travel_media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'travel_media');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'travel_media');

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_explorations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Read Access" ON users;
DROP POLICY IF EXISTS "Public Insert Access" ON users;
DROP POLICY IF EXISTS "Public Update Access" ON users;
DROP POLICY IF EXISTS "Public Read Access" ON places;
DROP POLICY IF EXISTS "Public Insert Access" ON places;
DROP POLICY IF EXISTS "Public Update Access" ON places;
DROP POLICY IF EXISTS "Public Read Access" ON reviews;
DROP POLICY IF EXISTS "Public Insert Access" ON reviews;
DROP POLICY IF EXISTS "Public Update Access" ON reviews;
DROP POLICY IF EXISTS "Public Read Access" ON bookmarks;
DROP POLICY IF EXISTS "Public Insert Access" ON bookmarks;
DROP POLICY IF EXISTS "Public Delete Access" ON bookmarks;
DROP POLICY IF EXISTS "Public Read Access" ON trending_hashtags;
DROP POLICY IF EXISTS "Public Insert Access" ON trending_hashtags;
DROP POLICY IF EXISTS "Public Update Access" ON trending_hashtags;
DROP POLICY IF EXISTS "Public Read Access" ON communities;
DROP POLICY IF EXISTS "Public Insert Access" ON communities;
DROP POLICY IF EXISTS "Public Update Access" ON communities;
DROP POLICY IF EXISTS "Public Delete Access" ON communities;
DROP POLICY IF EXISTS "Public Read Access" ON group_members;
DROP POLICY IF EXISTS "Public Insert Access" ON group_members;
DROP POLICY IF EXISTS "Public Delete Access" ON group_members;
DROP POLICY IF EXISTS "Public Read Access" ON messages;
DROP POLICY IF EXISTS "Public Insert Access" ON messages;
DROP POLICY IF EXISTS "Public Read Access" ON community_explorations;
DROP POLICY IF EXISTS "Public Insert Access" ON community_explorations;
DROP POLICY IF EXISTS "Public Read Access" ON user_views;
DROP POLICY IF EXISTS "Public Insert Access" ON user_views;
DROP POLICY IF EXISTS "Public Read Access" ON website_ratings;
DROP POLICY IF EXISTS "Public Insert Access" ON website_ratings;
DROP POLICY IF EXISTS "Public Read Access" ON user_posts;
DROP POLICY IF EXISTS "Public Insert Access" ON user_posts;
DROP POLICY IF EXISTS "Public Read Access" ON post_likes;
DROP POLICY IF EXISTS "Public Insert Access" ON post_likes;
DROP POLICY IF EXISTS "Public Delete Access" ON post_likes;
DROP POLICY IF EXISTS "Public Read Access" ON post_comments;
DROP POLICY IF EXISTS "Public Insert Access" ON post_comments;

-- Create fresh policies with explicit role targeting
CREATE POLICY "Public Read Access" ON users FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Insert Access" ON users FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public Update Access" ON users FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Public Read Access" ON places FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Insert Access" ON places FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public Update Access" ON places FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Public Read Access" ON reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Insert Access" ON reviews FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public Update Access" ON reviews FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Public Read Access" ON bookmarks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Insert Access" ON bookmarks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public Delete Access" ON bookmarks FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Public Read Access" ON trending_hashtags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Insert Access" ON trending_hashtags FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public Update Access" ON trending_hashtags FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Public Read Access" ON communities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Insert Access" ON communities FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public Update Access" ON communities FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Public Delete Access" ON communities FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Public Read Access" ON group_members FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Insert Access" ON group_members FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public Delete Access" ON group_members FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Public Read Access" ON messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Insert Access" ON messages FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Public Read Access" ON community_explorations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Insert Access" ON community_explorations FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Public Read Access" ON user_views FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Insert Access" ON user_views FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public Update Access" ON user_views FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Public Delete Access" ON user_views FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Public Read Access" ON website_ratings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Insert Access" ON website_ratings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Public Read Access" ON user_posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Insert Access" ON user_posts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Public Read Access" ON post_likes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Insert Access" ON post_likes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Public Delete Access" ON post_likes FOR DELETE TO authenticated USING (true);

CREATE POLICY "Public Read Access" ON post_comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Insert Access" ON post_comments FOR INSERT TO authenticated WITH CHECK (true);

-- 11. Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE places;
ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE trending_hashtags;
ALTER PUBLICATION supabase_realtime ADD TABLE communities;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE website_ratings;
ALTER PUBLICATION supabase_realtime ADD TABLE user_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE post_comments;
