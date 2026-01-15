-- Create Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Campaigns Table
CREATE TABLE campaigns (
  id UUID PRIMARY KEY,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'scheduled',
  analysis_file_path TEXT,
  batch_call_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (RLS) if needed, or keep it simple for now
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
