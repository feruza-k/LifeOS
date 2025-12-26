# Fix: Login Fails in Production

## Problem
Login fails because the backend CORS configuration doesn't allow the Vercel frontend domain.

## Solution

### Option 1: Add Vercel Domain to Railway Environment Variables (Recommended)

1. Go to **Railway Dashboard** → Your Backend Service → **Variables**
2. Add/Update:
   - **Name**: `ALLOWED_ORIGINS`
   - **Value**: `https://mylifeos.dev,https://www.mylifeos.dev,https://lifeos-indol.vercel.app,http://localhost:5173,http://localhost:8080`
   - This includes:
     - Your custom domain (`mylifeos.dev`)
     - Vercel deployment URL (`lifeos-indol.vercel.app`)
     - Local development URLs

3. **Redeploy** the backend service in Railway

### Option 2: Update Backend Code (Alternative)

If you want to hardcode it, update `backend/app/main.py`:

```python
# Around line 106
default_origins = "http://localhost:5173,http://localhost:8080,https://mylifeos.dev,https://www.mylifeos.dev,https://lifeos-indol.vercel.app"
```

Then commit and push, Railway will redeploy automatically.

## Why This Happens

- Backend CORS only allows origins in `ALLOWED_ORIGINS`
- Production frontend is on `mylifeos.dev` (Vercel)
- Backend needs to explicitly allow this origin
- Without it, CORS blocks the login request

## Verify It Works

After updating:
1. Open browser DevTools → Network tab
2. Try to login
3. Check the login request:
   - Should return 200 OK (not CORS error)
   - Cookies should be set
   - Response should include tokens

## Additional Check

Also verify in Railway:
- `ENVIRONMENT=production` is set
- `SECRET_KEY` is set
- `DATABASE_URL` is set

