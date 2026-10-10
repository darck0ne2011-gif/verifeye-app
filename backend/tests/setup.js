process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-long-enough'
delete process.env.DATABASE_URL
delete process.env.RENDER
delete process.env.SIGHTENGINE_USER
delete process.env.SIGHTENGINE_SECRET
delete process.env.SIGHTENGINE_API_USER
delete process.env.SIGHTENGINE_API_SECRET
delete process.env.DEEPSEEK_API_KEY
process.env.ADMIN_EMAILS = 'admin@example.com'
