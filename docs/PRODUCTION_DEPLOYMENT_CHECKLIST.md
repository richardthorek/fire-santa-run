# Production Deployment Checklist

This comprehensive checklist ensures all critical steps are completed before and after deploying to production.

## 📋 Table of Contents

1. [Pre-Deployment Preparation](#pre-deployment-preparation)
2. [Staging Environment Testing](#staging-environment-testing)
3. [Azure Services Validation](#azure-services-validation)
4. [Security Verification](#security-verification)
5. [Performance Testing](#performance-testing)
6. [Mobile Device Testing](#mobile-device-testing)
7. [Production Deployment](#production-deployment)
8. [Post-Deployment Validation](#post-deployment-validation)
9. [Monitoring Setup](#monitoring-setup)
10. [Rollback Procedures](#rollback-procedures)

---

## 1. Pre-Deployment Preparation

### Code Quality

- [ ] All tests passing locally (`npm test`)
- [ ] Linter passes with no errors (`npm run lint`)
- [ ] Build completes successfully (`npm run build`)
- [ ] TypeScript compilation successful (no type errors)
- [ ] No console errors or warnings in browser
- [ ] Code review completed and approved
- [ ] All PR comments addressed
- [ ] Security scan completed (CodeQL)
- [ ] Dependency vulnerabilities reviewed

### Documentation

- [ ] README.md updated with latest features
- [ ] MASTER_PLAN.md updated with implementation status
- [ ] API documentation current
- [ ] Environment variables documented in `.env.example`
- [ ] Deployment guide reviewed and updated
- [ ] Changelog updated with release notes

### Version Control

- [ ] All changes committed to feature branch
- [ ] Branch synced with main branch
- [ ] No merge conflicts
- [ ] Git history is clean (no WIP commits in main)
- [ ] Version number updated in `package.json`
- [ ] Release tag prepared (if applicable)

---

## 2. Staging Environment Testing

### Staging Deployment

- [ ] Staging environment exists and is accessible
- [ ] Deploy to staging environment
- [ ] Verify staging build completes successfully
- [ ] Staging URL is accessible
- [ ] No errors in Azure Static Web Apps deployment logs

### Core Features Validation

- [ ] **Home page loads correctly**
  - [ ] Branding and theme visible
  - [ ] Navigation functional
  - [ ] No console errors
  - [ ] Loading states work

- [ ] **Authentication system**
  - [ ] Login redirects to Entra ID
  - [ ] Sign-up flow works
  - [ ] Logout works
  - [ ] Token refresh works
  - [ ] Protected routes redirect properly
  - [ ] Session persistence across tabs

- [ ] **Brigade management**
  - [ ] Can search for brigades
  - [ ] Can claim brigade (with .gov.au email)
  - [ ] Brigade settings accessible
  - [ ] Member invitation works
  - [ ] Admin promotion/demotion works

- [ ] **Route planning**
  - [ ] Can create new route
  - [ ] Map loads and is interactive
  - [ ] Can add/edit/delete waypoints
  - [ ] Drag-and-drop waypoint reordering works
  - [ ] Route saves successfully
  - [ ] Route editing works
  - [ ] Route deletion works

- [ ] **Route publishing**
  - [ ] Can publish draft route
  - [ ] Shareable link generated
  - [ ] QR code generated and downloadable
  - [ ] Share panel displays correctly
  - [ ] Social media sharing works
  - [ ] Copy to clipboard works
  - [ ] Print preview works

- [ ] **Navigation system**
  - [ ] Turn-by-turn directions load
  - [ ] GPS location updates on map
  - [ ] Voice instructions work
  - [ ] Maneuver icons display correctly
  - [ ] Wake lock prevents screen sleep
  - [ ] ETA updates in real-time
  - [ ] Completed waypoints marked

- [ ] **Real-time tracking**
  - [ ] Location broadcasts work
  - [ ] Public tracking page receives updates
  - [ ] Multiple viewers can watch simultaneously
  - [ ] Tracking updates throttle correctly (5s)
  - [ ] Santa icon animates on map
  - [ ] Pause/resume tracking works

### Error Handling

- [ ] 404 page displays for invalid routes
- [ ] API errors show user-friendly messages
- [ ] Network failures handled gracefully
- [ ] Offline mode works (where applicable)
- [ ] Loading states prevent double-submission

---

## 3. Azure Services Validation

### Azure Table Storage

- [ ] Connection string configured in GitHub Secrets
- [ ] Tables exist:
  - [ ] `routes`
  - [ ] `brigades`
  - [ ] `users`
  - [ ] `memberships`
  - [ ] `invitations`
  - [ ] `verificationrequests`
- [ ] CORS configured for production domain
- [ ] Read operations work
- [ ] Write operations work
- [ ] Delete operations work
- [ ] Query filtering works
- [ ] Partition key strategy tested
- [ ] No dev tables (`dev*`) in production

### Azure Web PubSub

- [ ] Connection string configured in GitHub Secrets
- [ ] Negotiate endpoint returns connection URL
- [ ] WebSocket connections establish successfully
- [ ] Messages broadcast to groups
- [ ] Multiple clients can connect
- [ ] Connection limits not exceeded (Free tier: 20)
- [ ] Message rate within limits (Free tier: 20K/day)
- [ ] Reconnection on disconnect works

### Azure Static Web Apps

- [ ] Production deployment workflow successful
- [ ] Environment variables configured in Azure Portal:
  - [ ] `VITE_DEV_MODE=false`
  - [ ] `VITE_MAPBOX_TOKEN`
  - [ ] `VITE_ENTRA_CLIENT_ID`
  - [ ] `VITE_ENTRA_TENANT_ID`
  - [ ] `VITE_ENTRA_AUTHORITY`
  - [ ] `VITE_ENTRA_REDIRECT_URI`
- [ ] API functions deployed successfully
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate valid
- [ ] CDN cache working correctly

### Mapbox API

- [ ] Production Mapbox token configured
- [ ] Maps load correctly
- [ ] Geocoding works
- [ ] Directions API returns routes
- [ ] No API rate limit errors
- [ ] Token usage within free tier or billing configured

### Microsoft Entra External ID

- [ ] Tenant configured
- [ ] App registration created
- [ ] Redirect URIs include production URLs
- [ ] User flows configured
- [ ] Test user can sign up
- [ ] Test user can sign in
- [ ] Email verification works
- [ ] Token validation works in API

---

## 4. Security Verification

### HTTPS & Transport Security

- [ ] Site served over HTTPS only
- [ ] SSL certificate valid and not expiring soon
- [ ] HTTP redirects to HTTPS
- [ ] HSTS header present (`Strict-Transport-Security`)
- [ ] Secure cookies (SameSite, HttpOnly)

### Security Headers

- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY` or `SAMEORIGIN`
- [ ] `Content-Security-Policy` configured
- [ ] `Referrer-Policy` set
- [ ] No sensitive data in client-side code

### Authentication & Authorization

- [ ] No hardcoded credentials in code
- [ ] API endpoints validate authentication
- [ ] Brigade isolation enforced (users can't access other brigades)
- [ ] Admin actions require admin role
- [ ] Domain whitelist enforced for admin promotion
- [ ] Session timeout configured
- [ ] Token expiration works

### Data Protection

- [ ] No sensitive data in URLs (e.g., no auth tokens in query strings)
- [ ] No PII in logs
- [ ] Azure Storage connection strings in secrets only
- [ ] No secrets committed to Git
- [ ] Environment variables not exposed to client

### Vulnerability Scanning

- [ ] npm audit passes (or vulnerabilities triaged)
- [ ] CodeQL security scan passes
- [ ] OWASP Top 10 considerations reviewed
- [ ] Dependencies up to date
- [ ] No known CVEs in production dependencies

---

## 5. Performance Testing

### Load Testing

- [ ] Run load test script: `node scripts/load-test.js <staging-url> 50`
- [ ] 50+ concurrent users handled successfully
- [ ] Success rate ≥ 95%
- [ ] Average response time < 2 seconds
- [ ] P95 response time < 3 seconds
- [ ] P99 response time < 5 seconds
- [ ] No server errors under load
- [ ] WebSocket connections stable under load

### Performance Metrics

- [ ] Home page loads in < 3 seconds
- [ ] API response times < 500ms average
- [ ] Time to Interactive (TTI) < 5 seconds
- [ ] First Contentful Paint (FCP) < 2 seconds
- [ ] Bundle size optimized (check build output)
- [ ] Images optimized and compressed
- [ ] Lazy loading implemented where appropriate

### Lighthouse Audit (Optional but Recommended)

- [ ] Run Lighthouse: `npm run audit:lighthouse`
- [ ] Performance score ≥ 80
- [ ] Accessibility score ≥ 90
- [ ] Best Practices score ≥ 90
- [ ] SEO score ≥ 80
- [ ] PWA checklist reviewed (if applicable)

---

## 6. Mobile Device Testing

### iOS Testing

- [ ] **iPhone SE (small screen)**
  - [ ] App loads and displays correctly
  - [ ] Navigation responsive
  - [ ] Touch targets adequate size (44x44px)
  - [ ] Forms usable
  - [ ] Maps interactive
- [ ] **iPhone 12/13/14 (standard screen)**
  - [ ] Full feature functionality
  - [ ] GPS tracking works
  - [ ] Voice instructions work (Safari)
  - [ ] QR code scanner works
- [ ] **iPad (tablet)**
  - [ ] Layout adapts to larger screen
  - [ ] All features accessible

### Android Testing

- [ ] **Android phone (standard screen)**
  - [ ] App loads and displays correctly
  - [ ] Navigation responsive
  - [ ] Touch targets adequate
  - [ ] Forms usable
  - [ ] Maps interactive
- [ ] **Android phone (GPS tracking)**
  - [ ] GPS tracking works
  - [ ] Voice instructions work (Chrome)
  - [ ] Location permissions requested correctly
- [ ] **Android tablet**
  - [ ] Layout adapts to larger screen

### Browser Testing

- [ ] **Mobile Safari (iOS)**
  - [ ] App fully functional
  - [ ] No console errors
  - [ ] Geolocation works
  - [ ] Wake Lock works
- [ ] **Chrome (Android)**
  - [ ] App fully functional
  - [ ] No console errors
  - [ ] Geolocation works
  - [ ] Wake Lock works
- [ ] **Firefox (mobile)**
  - [ ] App functional (best effort)
  - [ ] Core features work

### Device-Specific Features

- [ ] Geolocation permission requested correctly
- [ ] Camera access for QR scanner works (if applicable)
- [ ] Screen orientation lock works for navigation
- [ ] Device back button handled correctly (Android)
- [ ] Pull-to-refresh disabled where needed
- [ ] Viewport zoom disabled for navigation

---

## 7. Production Deployment

### Pre-Deployment

- [ ] All checklist items above completed
- [ ] Stakeholders notified of deployment
- [ ] Maintenance window scheduled (if needed)
- [ ] Backup of current production state taken
- [ ] Rollback plan ready

### GitHub Actions Deployment

- [ ] Create PR to `main` branch
- [ ] PR checks pass (lint, test, build)
- [ ] Code review approved
- [ ] Merge PR to `main`
- [ ] GitHub Actions workflow triggered
- [ ] Quality checks pass
- [ ] Build and deploy job succeeds
- [ ] Azure Static Web Apps deployment succeeds

### Deployment Verification

- [ ] Deployment logs reviewed (no errors)
- [ ] New version deployed (check build timestamp)
- [ ] Old preview environments closed
- [ ] Production URL accessible

---

## 8. Post-Deployment Validation

### Smoke Tests

- [ ] Run smoke tests: `node scripts/smoke-test.js <production-url>`
- [ ] All smoke tests pass
- [ ] No critical warnings

### Manual Verification

- [ ] Home page loads correctly
- [ ] Login works
- [ ] Can create and publish a route
- [ ] Can view public tracking page
- [ ] Real-time tracking updates work
- [ ] No console errors in browser
- [ ] API endpoints responding correctly

### Monitoring Checks

- [ ] Application Insights shows traffic
- [ ] No error spikes in logs
- [ ] Response times normal
- [ ] No failed requests
- [ ] Azure resources healthy

### User Communication

- [ ] Update status page (if applicable)
- [ ] Notify users of new features
- [ ] Update documentation links
- [ ] Post release notes

---

## 9. Monitoring Setup

### Azure Monitoring

- [ ] Application Insights enabled
- [ ] Alert rules configured:
  - [ ] Failed requests > 5% in 5 minutes
  - [ ] Response time > 5 seconds
  - [ ] Availability < 95%
- [ ] Dashboard created for key metrics
- [ ] Log Analytics workspace configured

### Health Checks

- [ ] `/api/health` endpoint (if created) returning 200
- [ ] Uptime monitoring configured (Azure Monitor, external)
- [ ] SSL certificate expiration monitoring
- [ ] Domain expiration monitoring (if custom domain)

### Error Tracking

- [ ] Error logs monitored (Azure Static Web Apps logs)
- [ ] API function errors logged
- [ ] Client-side errors captured (if error tracking service used)
- [ ] Weekly error review scheduled

---

## 10. Rollback Procedures

### When to Rollback

Rollback if:
- Critical functionality broken (authentication, routing, tracking)
- Security vulnerability introduced
- Performance degradation > 50%
- Data loss or corruption detected
- More than 10% of users affected by bugs

### Rollback Steps

1. **Immediate Action**
   - [ ] Notify team of issue
   - [ ] Document the problem clearly
   - [ ] Assess severity (critical/major/minor)

2. **Revert Deployment**
   - [ ] Go to GitHub repository
   - [ ] Revert the merge commit on `main` branch
   - [ ] Push revert commit
   - [ ] Wait for automatic deployment (or trigger manually)

3. **Verify Rollback**
   - [ ] Previous version deployed successfully
   - [ ] Production site functional
   - [ ] Run smoke tests on rolled-back version
   - [ ] Verify user reports issue is resolved

4. **Fix Forward**
   - [ ] Create hotfix branch
   - [ ] Fix the issue
   - [ ] Test thoroughly
   - [ ] Deploy hotfix following this checklist

5. **Post-Mortem**
   - [ ] Document what went wrong
   - [ ] Identify why it wasn't caught in testing
   - [ ] Update testing procedures to prevent recurrence
   - [ ] Share learnings with team

---

## 📝 Notes

- **Deployment Frequency:** Follow continuous deployment for small changes; use maintenance windows for major updates.
- **Testing Priority:** Focus on P0 features (authentication, route creation, tracking) in every deployment.
- **Mobile Testing:** Real device testing is critical - simulator/emulator testing is not sufficient.
- **Performance:** Monitor performance metrics for 24 hours after deployment to catch regressions.

---

## ✅ Final Sign-Off

- [ ] Deployment owner reviewed checklist
- [ ] Technical lead approved deployment
- [ ] All critical items completed
- [ ] Production deployment successful
- [ ] Post-deployment validation passed

**Deployed by:** ________________  
**Date:** ________________  
**Version:** ________________  
**Production URL:** ________________  

---

*This checklist is a living document. Update it based on lessons learned from each deployment.*
