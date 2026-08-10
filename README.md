# NewlyNow Storefront

This repository contains the storefront currently being migrated to the **NewlyNow** identity.

## Active migration

Development is being performed on a review branch before production merge:

`newlynow-theme-moburst-inspired`

The current migration includes:

- NewlyNow dark editorial / neon storefront theme
- Homepage, category, service, checkout and account styling layers
- NewlyNow admin dashboard styling layer
- Removal/migration of legacy Elwaset / Elawaady XDigital presentation
- Cart storage migration to `newlynow_cart`
- Firestore public-write validation and user document protections
- Firebase Storage upload type/size validation
- Safer announcement links and local notification-state migration
- Git ignore rules for secrets, service-account keys and local databases

## Important

The Firebase project identifier may still use its historical project ID internally. Do not rename or replace Firebase project identifiers merely for branding. Public-facing branding is NewlyNow; infrastructure identifiers should only be changed through a planned migration.

## Production safety

Do not merge security-rule changes or payment changes to production without testing the complete order, account, review, admin and upload flows in a staging environment or Firebase Emulator Suite first.
