# הפעלה ראשונה של Next.js + Supabase

הקוד מוכן. מה שחסר זה פרויקט Supabase אמיתי שהוא יתחבר אליו.
כל שלב כאן הוא בדיוק מה ללחוץ.

## 1. יצירת הפרויקט

1. להיכנס ל-https://supabase.com ולהתחבר עם `barakliver@gmail.com`.
2. **New project**.
3. Name: `liver-productions`.
4. Database Password: ללחוץ **Generate a password** ולשמור אותו במקום בטוח.
5. Region: **Frankfurt (eu-central-1)** — הכי קרוב לישראל.
6. **Create new project**. לוקח בערך שתי דקות.

## 2. הרצת הסכמה

1. בתפריט הצדדי: **SQL Editor** ואז **New query**.
2. להעתיק את כל התוכן של `supabase/migrations/0001_init.sql` ולהדביק. **Run**.
3. **New query** שוב, להעתיק את כל `supabase/migrations/0002_auth_bootstrap.sql`. **Run**.

הסדר חשוב: 0001 קודם, 0002 אחריו.

## 3. הגדרת הכניסה במייל

1. **Authentication** ואז **Providers** ואז **Email**.
2. לוודא ש-**Enable Email provider** דלוק.
3. לכבות **Confirm email** (הכניסה היא עם קוד חד פעמי, אין סיסמה לאשר).
4. **Authentication** ואז **URL Configuration**: ב-Site URL לכתוב `https://liverproductions.com`.
5. **Authentication** ואז **Emails** ואז תבנית **Magic Link**: לוודא שהתבנית מכילה את
   `{{ .Token }}` ולא רק את הקישור. זה הקוד בן שש הספרות שהמסך מבקש.

## 4. חיבור המפתחות לאתר

1. **Project Settings** ואז **API**.
2. להעתיק את שלושת הערכים לתוך קובץ `.env.local` בתיקיית `liver-next`:

```
NEXT_PUBLIC_SUPABASE_URL=       # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # anon public
SUPABASE_SERVICE_ROLE_KEY=      # service_role  ← סודי, לא נכנס ל-git לעולם
NEXT_PUBLIC_SITE_URL=https://liverproductions.com
```

`service_role` עוקף את כל הרשאות האבטחה. הוא נשאר רק בשרת.

## 5. הכניסה הראשונה

1. `npm run dev` בתוך `liver-next`.
2. לפתוח `http://localhost:3000/login`.
3. להזין `barakliver@gmail.com`, לקבל קוד במייל, להזין אותו.

הכתובת הזאת מקבלת `super_admin` אוטומטית, והמרחב שלה נפתח מאושר.
**כל כתובת אחרת** נפתחת במצב `pending` ולא יכולה לעשות כלום עד אישור,
במסך **ניהול מערכת**. זה נאכף בבסיס הנתונים עצמו, לא רק במסך.

## מה נבדק מול בסיס נתונים אמיתי

הורצו שתי המיגרציות על PostgreSQL 16 והועמדו במבחן שלוש עשרה התנהגויות:

- הכתובת הראשית הופכת ל-`super_admin` עם מרחב מאושר.
- כל הרשמה אחרת הופכת ל-`producer` עם מרחב `pending`.
- כתובת שהוזמנה לאירוע נפתחת כ-`client`, בלי מרחב הפקה משלה.
- מפיק לא יכול לאשר את עצמו.
- מפיק לא יכול לשנות את התפקיד של עצמו.
- מפיק שממתין לאישור לא יכול ליצור אירוע.
- מפיק שממתין לאישור כן יכול לערוך את פרטי העסק שלו.
- מפיק לא רואה אירועים של אף אחד אחר.
- אחרי אישור, מפיק יכול ליצור אירוע.
- זוג רואה את האירוע שלו בלבד, ולא יכול ליצור אירוע.
- מרחב מקבל לכל היותר שתי כתובות.
- מפיק שלא אושר ומוזמן לאירוע עובר להיות `client`.
- מפיק מאושר שמוזמן לאירוע נשאר מפיק.
