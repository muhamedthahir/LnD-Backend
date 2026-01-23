# CORS Error Fix Documentation

## Error Description

The error you encountered:
```
Access to fetch at 'https://d1qio8dibp2agp.cloudfront.net/api/questions' 
from origin 'https://dnv2vd007hcre.cloudfront.net' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.

POST https://d1qio8dibp2agp.cloudfront.net/api/questions net::ERR_FAILED 403 (Forbidden)
```

## Root Causes

### 1. **Backend CORS Headers Not Set on Error Responses**
   - When authentication middleware returns 401/403 errors, CORS headers weren't being included
   - Browser blocks the response because it can't see the CORS headers

### 2. **CloudFront Configuration (Possible)**
   - CloudFront might be blocking requests before they reach the backend
   - CloudFront response headers policy might not be forwarding CORS headers
   - CloudFront origin request policy might be blocking cross-origin requests

## Fix Applied

### Backend CORS Middleware Update (`app.js`)

The CORS middleware has been updated to:
1. **Always set CORS headers** - Even on error responses (401, 403, 500, etc.)
2. **Override `res.json()` and `res.status()`** - Ensures headers are set before any response is sent
3. **Handle all CloudFront origins** - Automatically allows any `*.cloudfront.net` domain

### Key Changes:
- CORS headers are now set using `res.setHeader()` which persists through error responses
- Override `res.json()` and `res.status()` to ensure headers are always included
- Headers are set both before `next()` and in the response methods

## Verification Steps

### 1. Test Backend CORS Headers
```bash
# Test from frontend origin
curl -X OPTIONS https://d1qio8dibp2agp.cloudfront.net/api/questions \
  -H "Origin: https://dnv2vd007hcre.cloudfront.net" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Should see:
# Access-Control-Allow-Origin: https://dnv2vd007hcre.cloudfront.net
# Access-Control-Allow-Credentials: true
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
```

### 2. Test Error Response with CORS
```bash
# Test without authentication (should return 401 with CORS headers)
curl -X POST https://d1qio8dibp2agp.cloudfront.net/api/questions \
  -H "Origin: https://dnv2vd007hcre.cloudfront.net" \
  -H "Content-Type: application/json" \
  -v

# Should see CORS headers even in 401 response
```

### 3. Check CloudFront Configuration

If errors persist after backend fix, check CloudFront:

1. **Response Headers Policy:**
   - Ensure CORS headers are forwarded from origin
   - Or configure CloudFront to add CORS headers

2. **Origin Request Policy:**
   - Should allow all headers (Origin, Authorization, etc.)
   - Should forward query strings and cookies

3. **Cache Policy:**
   - For API endpoints, use "CachingDisabled" or "Managed-CachingDisabled"
   - Don't cache OPTIONS requests

4. **CloudFront Distribution Settings:**
   - Ensure the frontend origin (`https://dnv2vd007hcre.cloudfront.net`) is allowed
   - Check if there are any WAF rules blocking requests

## Common Issues

### Issue 1: 403 Forbidden from CloudFront
**Symptom:** Request never reaches backend, 403 from CloudFront

**Solution:**
- Check CloudFront origin access settings
- Verify CloudFront has permission to access the backend
- Check if CloudFront is using OAC (Origin Access Control) or OAI (Origin Access Identity)
- Ensure backend allows requests from CloudFront

### Issue 2: CORS Headers Missing on Error Responses
**Symptom:** 401/403 responses don't include CORS headers

**Solution:** ✅ Fixed in this update - CORS headers are now always set

### Issue 3: Preflight (OPTIONS) Request Failing
**Symptom:** Browser sends OPTIONS request, gets 403 or no CORS headers

**Solution:** ✅ Fixed - OPTIONS requests now return 200 with proper CORS headers

## Testing Checklist

- [ ] OPTIONS preflight requests return 200 with CORS headers
- [ ] POST requests with valid auth return 200/201 with CORS headers
- [ ] POST requests without auth return 401 with CORS headers
- [ ] POST requests with insufficient permissions return 403 with CORS headers
- [ ] Error responses (500) include CORS headers
- [ ] All CloudFront origins are allowed

## Next Steps

1. **Deploy the updated backend** with the CORS fix
2. **Test the API** from the frontend
3. **If issues persist**, check CloudFront configuration
4. **Monitor logs** for any CORS-related errors

## Additional Notes

- The backend now automatically allows any `*.cloudfront.net` domain
- CORS headers are set on every response, including errors
- The fix ensures headers persist through Express middleware chain
- CloudFront might need configuration updates if the issue persists

