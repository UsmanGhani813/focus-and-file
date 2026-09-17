# Time Tracker Plus

Build a complete, production-ready, responsive full-stack To-Do / Work Tracking web application using Lovable + Supabase.

The application should have a clean, modern, professional SaaS-style UI and should work perfectly on both desktop and mobile.

1. TECH STACK

Use:

Lovable for the frontend/application

Supabase for:

Authentication

PostgreSQL database

Storage for uploaded files

Row Level Security (RLS)

React + TypeScript

Modern responsive UI

Use proper loading states, error states, empty states, form validation and success notifications.

Do not use fake/mock data for the actual application functionality.

2. USER AUTHENTICATION

When a new visitor opens the application, provide two options:

Login

Register Yourself

Registration

The registration flow should collect:

Email

Password

Full Name

Phone Number

The email and password must be handled through Supabase Authentication.

Do NOT store passwords manually in a normal database table or as plain text.

After successful registration:

Create the user's authentication account through Supabase Auth.

Create the corresponding profile record in a profiles table.

Store:

User ID

Full Name

Email

Phone Number

Created At

Updated At

After account creation, automatically take the user to the main application.

3. LOGIN

Existing users should be able to log in using:

Email

Password

Use Supabase Auth.

After successful login, redirect the user to the Home page.

Users who are not authenticated should not be able to access authenticated application features.

4. DATABASE STRUCTURE

Create a proper Supabase database schema.

profiles table

Fields:

id (UUID, linked to auth.users)

full_name

email

phone

avatar_url (optional)

created_at

updated_at

work_sessions table

Each completed work session should contain:

id

user_id

title

description

started_at

stopped_at

duration_seconds

created_at

updated_at

The duration should be calculated accurately from the start and stop timestamps.

attachments table

Each attachment should contain:

id

work_session_id

user_id

file_name

file_path

file_type

file_size

created_at

Use Supabase Storage for the actual files.

5. SECURITY

Implement proper Supabase Row Level Security.

Important:

A user can create and manage their own work sessions.

A user can upload and manage their own attachments.

A user can update their own profile.

Authentication must be handled securely.

Passwords must NEVER be exposed in the frontend or normal database tables.

Do not expose private authentication information publicly.

Public History should only expose the information intentionally designed to be public.

Do not create insecure policies just to make the application work.

6. MAIN HOME PAGE

After login, the user should see a beautiful single-page dashboard.

The top navigation should contain:

Home

History

User/Profile menu

The main Home screen should focus heavily on the work timer.

Create a large circular timer interface in the center of the screen.

Initially show:

START

inside a large circular button.

When the user clicks START:

Start the timer immediately.

Record the exact start timestamp.

Change the interface to a running timer.

Display elapsed time clearly.

Show a large circular STOP button.

The timer should continue accurately even if the UI re-renders.

Do not rely only on incrementing a JavaScript counter.

Calculate elapsed time using timestamps so that the timer remains accurate.

7. STOP WORKFLOW

When the user clicks STOP:

Immediately stop the timer.

Record the exact stopped timestamp.

Calculate the total duration.

Do NOT automatically create the final work record yet.

Instead, open a work-completion form.

The form should contain:

Work Title

Required.

Description

Optional but recommended.

Attachments

Allow the user to upload evidence/files related to the completed work.

The user should be able to upload screenshots and other common document/file formats.

Examples:

PNG

JPG

JPEG

WEBP

PDF

DOC

DOCX

XLS

XLSX

TXT

ZIP

and other reasonable file types.

However, implement sensible file-size limits and secure file validation.

Show uploaded files before submission and allow the user to remove an attachment before submitting.

8. SUBMIT WORK

After entering the work information, display a clear:

SUBMIT WORK

button.

When the user clicks it:

Validate the form.

Create the work session record in Supabase.

Save the calculated duration.

Upload attachments to Supabase Storage.

Create attachment records in the database.

Associate everything with the authenticated user.

Show a success notification.

Reset the timer/work form.

Return the user to the Home dashboard.

The completed work should immediately become available in History.

9. HISTORY PAGE

Create a separate History page accessible from the top navigation.

The History page should allow users to explore completed work.

At the top provide:

ALL

User list / user names

Search

Optional filtering

When the user selects ALL, display completed work sessions from all users that are permitted to be publicly visible.

Sort the work sessions by:

Latest completed work first.

The most recently completed work should appear at the top.

Older work should appear below it.

10. USER HISTORY

On the History page, display the names of registered users who have publicly visible work history.

When someone clicks a user's name:

Open that user's work history.

Show:

User's name

Work completed by that user

Work titles

Descriptions

Start time

Stop time

Total duration

Completion date/time

Available attachments

Sort that user's work by latest completed work first.

11. WORK DETAIL VIEW

When a visitor clicks a particular work item, open a detailed view/modal/page.

Display:

Work title

Description

Start date/time

Stop date/time

Total duration

Attachments

Completion date/time

Person who completed the work

For attachments:

Images should have a preview.

PDFs/documents should show the file name and an appropriate open/download action.

Do not expose raw Supabase storage paths unnecessarily.

12. PUBLIC VS PRIVATE DATA

Make the privacy model clear.

Public History can show:

User's full name

Publicly visible completed work

Work title

Work description

Start/stop time

Duration

Public attachments

Do NOT expose:

Password

Authentication credentials

Private Supabase Auth information

Sensitive account information.

If needed, create a field such as:

is_public

on work sessions.

This should allow the application to control whether a work record appears in public History.

13. PROFILE

Create a user profile area.

The authenticated user should be able to view and edit:

Full Name

Email

Phone Number

Email should be handled according to Supabase Auth rules.

Allow the user to securely update their profile information.

14. RESPONSIVE DESIGN

The application must be fully responsive.

Desktop:

Sidebar/top navigation

Large circular timer

Clean dashboard layout

Mobile:

Responsive navigation

Large touch-friendly START/STOP button

Work forms optimized for mobile

Attachment upload optimized for mobile

History cards optimized for small screens.

15. UI/UX DESIGN

Create a modern, minimal and professional interface.

The timer should be the visual focus of the Home page.

Use:

Large typography

Clean cards

Smooth transitions

Clear buttons

Good spacing

Professional dashboard design

Accessible contrast

Responsive layout

Loading indicators

Toast notifications

Confirmation states

Empty states

Do not make the interface unnecessarily complicated.

The user should immediately understand:

START → WORK → STOP → ADD DETAILS → ATTACH EVIDENCE → SUBMIT

16. ERROR HANDLING

Handle all important cases properly:

Invalid email

Weak password

Existing email

Wrong login credentials

Network failure

Database failure

File upload failure

Unsupported file

File too large

Session expiration

Unauthorized access

Show useful human-readable error messages.

17. TIMER EDGE CASES

Handle timer edge cases carefully.

If the browser refreshes while a timer is running:

Preserve the active session state.

Recover the timer from the stored start timestamp.

If the user closes and reopens the browser while an active timer exists:

Restore the active timer when possible.

A user should not accidentally lose a running work session because of a page refresh.

Prevent multiple timers from running simultaneously for the same user.

18. DATABASE + STORAGE SETUP

Actually connect the application to Supabase.

Create:

Required database tables

Foreign keys

Indexes where appropriate

RLS policies

Storage bucket(s)

Storage security policies

Use environment variables for Supabase configuration.

Do not hardcode secrets.

19. FINAL APPLICATION FLOW

The complete user journey should be:

Visitor opens website
↓
Login / Register Yourself
↓
Register with Email + Password + Name + Phone
↓
Supabase Authentication
↓
Profile created
↓
Home Dashboard
↓
Click START
↓
Timer starts
↓
User performs work
↓
Click STOP
↓
Work completion form appears
↓
Enter Work Title
↓
Enter Description
↓
Upload Screenshot / Evidence / Files
↓
Click SUBMIT WORK
↓
Data + duration + attachments saved to Supabase
↓
Return to Home
↓
History
↓
ALL / Select User
↓
View completed work
↓
Open Work Detail
↓
View duration + information + attachments

20. IMPORTANT IMPLEMENTATION REQUIREMENTS

Build this as a REAL working application, not a visual prototype.

Do not use dummy authentication.

Do not use fake local data instead of Supabase.

Do not store passwords manually.

Use Supabase Auth for authentication.

Use Supabase PostgreSQL for application data.

Use Supabase Storage for attachments.

Use proper RLS policies.

Make all CRUD operations functional.

Make the timer functional and timestamp-based.

Make History functional and connected to the database.

Make file uploads functional.

Make the entire application responsive.

Before finishing, test the complete flow:

Register → Login → Profile → Start Timer → Stop → Add Work Details → Upload Attachment → Submit → History → User History → Work Details.

Fix any errors you encounter and ensure the application works end-to-end.

If a design or implementation decision is not explicitly specified above, choose the simplest secure and scalable approach that fits the application.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://focus-and-file.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3dab525e-ea19-42ee-816a-8f8ea83320e5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
