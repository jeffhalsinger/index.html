# AI Mechanic — complete setup guide

Written for someone who has never written code. Every step is a thing you type or
click. If a step doesn't work, jump to **Troubleshooting** at the bottom.

Total time: about 45 minutes, most of it waiting.

---

## What you are building

Three pieces:

| Piece | What it is | Where it lives |
|---|---|---|
| **The app** | What you install on your Android phone | `ai-mechanic/` folder |
| **The server** | A tiny website that talks to the AI and to YouTube | `server/` folder |
| **Two API keys** | Passwords that let the server use Claude and YouTube | Stored on the server only |

**Why is there a server?** Because API keys must never be inside a phone app.
Anyone can unpack an APK and read the keys out of it, then run up your bill. The
server holds the keys; the app just asks the server for answers.

---

## Part 1 — Install the two tools you need (10 minutes)

### 1.1 Install Node.js

1. Go to **https://nodejs.org**
2. Click the big green button that says **LTS** (it will say something like "22.x.x LTS")
3. Open the file that downloads and click **Next / Continue** through the installer,
   accepting all defaults
4. Now open a terminal:
   - **Windows:** press the Windows key, type `powershell`, press Enter
   - **Mac:** press Cmd+Space, type `terminal`, press Enter
5. Type this and press Enter:
   ```
   node --version
   ```
   You should see something like `v22.14.0`. If you see "command not found", close
   the terminal, open a new one, and try again.

**Keep this terminal window open. You will use it for everything below.**

### 1.2 Go to the project folder

In the terminal, type `cd ` (with a space), then drag the project folder from your
file manager onto the terminal window and press Enter. That fills in the path for you.

To check you are in the right place, type:
```
ls
```
You should see `ai-mechanic`, `server`, and `SETUP.md` listed.

---

## Part 2 — Get your two API keys (10 minutes)

### 2.1 The Anthropic key (this is what writes the repair guides)

1. Go to **https://console.anthropic.com**
2. Click **Sign up** and create an account with your email
3. You must add money before the API will work. Click **Plans & Billing** in the left
   sidebar, then **Add credits**. **$5 is plenty** to start — each repair guide costs
   a few cents.
4. Click **API keys** in the left sidebar
5. Click **Create key**
6. Name it `ai-mechanic` and click **Create**
7. **Copy the key now.** It starts with `sk-ant-`. You will never be shown it again.
   Paste it into a text file temporarily so you don't lose it.

### 2.2 The YouTube key (this is what searches for videos)

1. Go to **https://console.cloud.google.com**
2. Sign in with any Google account
3. At the top of the page there is a project dropdown (it may say "Select a project").
   Click it, then click **New project**
4. Name it `ai-mechanic` and click **Create**. Wait about 20 seconds, then make sure
   that project is selected in the dropdown at the top.
5. In the search bar at the very top, type `YouTube Data API v3` and click the result
6. Click the blue **Enable** button. Wait for it to finish.
7. Now in the left sidebar click **APIs & Services**, then **Credentials**
8. Click **+ Create credentials** at the top, then choose **API key**
9. A box appears with your key. **Click the copy icon** and paste it into your text
   file next to the other one.
10. Click **Close**.

This is free. Google gives you enough daily quota for roughly 100 repair guides per
day at no charge.

---

## Part 3 — Put the server online (10 minutes)

We use Vercel because it is free and takes one command.

### 3.1 Create a Vercel account

1. Go to **https://vercel.com/signup**
2. Click **Continue with Email** (or GitHub if you have one) and finish signing up

### 3.2 Deploy

In your terminal, type these one at a time, pressing Enter after each:

```
cd server
```
```
npm install
```
```
npx vercel login
```
Follow the prompts — it will email you a link to click, or open your browser.

Now deploy:
```
npx vercel
```

It will ask you several questions. **Press Enter to accept the default for every
one of them**, except:
- "Set up and deploy?" → type `y` and press Enter
- "In which directory is your code located?" → press Enter (the default `./` is correct)

When it finishes it prints a web address like:

```
https://server-abc123xyz.vercel.app
```

**Copy that address into your text file.** This is your server. You need it twice more
below.

### 3.3 Give the server your two keys

Type these three commands. Each one will ask you to paste a value:

```
npx vercel env add ANTHROPIC_API_KEY production
```
Paste your `sk-ant-...` key and press Enter.

```
npx vercel env add YOUTUBE_API_KEY production
```
Paste your Google key and press Enter.

If either command asks which environments to apply to, choose **Production** (use the
arrow keys and space bar, then Enter).

Now redeploy so the server can actually see those keys:

```
npx vercel --prod
```

**This last command prints the FINAL address. Use this one, not the earlier one.**
It looks like `https://server-abc123xyz.vercel.app`. Copy it to your text file.

### 3.4 Check the server is alive

There is a script that tests both API keys for you. Run it with your address:

```
node test/ping.mjs https://YOUR-ADDRESS.vercel.app
```

After about a minute you should see something like:

```
1/2  Asking for a repair guide (uses your Anthropic key)...
     PASS - got 8 steps
     understood: 2014 Honda Civic - Replace the front brake pads
     assumed: Squealing and grinding on braking points to worn front pads.
     first step: Park safely and break the lug nuts loose

2/2  Finding video clips for those steps (uses your YouTube key)...
     searched 5 videos
     matched 6 of 8 steps to a clip
       step 1: <video-id> @ 42s (high)
       ...
     PASS
```

**If both say PASS, everything works.** The script tells you exactly which key is at
fault if one fails. Matching 6 of 8 steps is a normal, good result — not every step
appears clearly in every video.

---

## Optional shortcut — try it on your phone now, without building an APK

Building the APK takes 15–20 minutes of waiting. If you just want to *see it working*
first, **Expo Go** runs the real app on your phone over wifi in about five minutes.
Video playback and everything else works; the only catch is that your computer has to
stay on and on the same wifi.

1. Copy `ai-mechanic/.env.example` to a new file called `ai-mechanic/.env`
2. Open that new `.env` file and put your server address in it, so it reads:
   ```
   EXPO_PUBLIC_API_URL=https://your-address.vercel.app
   ```
3. On your phone, install **Expo Go** from the Play Store
4. On your computer:
   ```
   cd ai-mechanic
   ```
   ```
   npm install
   ```
   ```
   npx expo start
   ```
5. A QR code appears in the terminal. Open Expo Go on your phone and scan it.

The app loads straight onto your phone. Press `Ctrl+C` in the terminal when you're done.

When you're happy with it, carry on to Parts 4 and 5 below to build the real APK — that
version keeps working with your computer switched off.

> The `.env` file is only used by `npx expo start`. The APK build reads the address from
> `eas.json` instead, which is why Part 4 exists.

---

## Part 4 — Point the app at your server (2 minutes)

This is the one file you must edit by hand.

1. Open the file `ai-mechanic/eas.json` in any text editor (Notepad works)
2. Find the three lines that say:
   ```
   "EXPO_PUBLIC_API_URL": "https://REPLACE-ME.vercel.app"
   ```
3. Replace `https://REPLACE-ME.vercel.app` with your real address **in all three
   places**. Keep the quotes. No slash at the end.
4. Save the file.

It should end up looking like `"EXPO_PUBLIC_API_URL": "https://server-abc123xyz.vercel.app"`.

---

## Part 5 — Build the APK with EAS (15 minutes, mostly waiting)

### 5.1 Create a free Expo account

1. Go to **https://expo.dev/signup**
2. Sign up with your email and remember the username and password

### 5.2 Log in and build

Back in the terminal:

```
cd ../ai-mechanic
```
```
npm install
```
```
npx eas-cli login
```
Enter the Expo username and password you just created.

Now start the build:

```
npx eas-cli build --platform android --profile preview
```

Answer the questions it asks:

- **"Generate a new Android Keystore?"** → type `y` and press Enter.
  (This is the signing certificate. Let Expo create and store it — you never need to
  think about it again.)
- If it asks anything about the project ID or creating a project → press Enter to accept.

Then it uploads your code and prints a link like:

```
Build details: https://expo.dev/accounts/you/projects/ai-mechanic/builds/xxxx
```

**The build takes 10–20 minutes.** You can leave the terminal open, or open that link
in a browser to watch the progress bar. Go make coffee.

### 5.3 Get the APK onto your phone

When it finishes, the terminal shows a download link and a QR code.

**Easiest way:**
1. On your **phone**, open the camera and scan the QR code in the terminal
   (or open the build link from 5.2 in your phone's browser)
2. Tap the big **Install** button on that page
3. Android will warn you: *"For your security, your phone is not allowed to install
   unknown apps from this source."* Tap **Settings**, then turn on
   **Allow from this source**, then press the back button
4. Tap **Install** again, then **Open**

That warning is normal. It appears for every app not from the Play Store.

**You're done.** The app is on your phone.

---

## Using it

There is one box. Type whatever you want into it:

- `2014 Honda Civic, replace the front brake pads`
- `my civic squeals and grinds when I brake`
- `2011 F-150 5.0, need to change the spark plugs`

You don't have to name the repair. Describe the symptom and the AI works out what
needs doing.

1. Type your message (or tap one of the examples)
2. Tap **Build my repair guide**
3. Wait 30–60 seconds
4. Read the overview page — tools, safety, and **what the AI assumed**
5. Tap **Start**, then **Next** through the steps

**Check the green "What I assumed" box on the overview.** When you describe a symptom
instead of a job, that box is where the AI tells you what it decided you need. If it
guessed wrong, tap **New** and add the missing detail.

If your message is too vague to act on — no vehicle named, or just "it makes a noise" —
the app asks you one question and keeps what you already typed, so you only add the
missing bit.

If a step has no video, it says so and shows the written instructions. That is
expected and not a bug — see the note below.

---

## Things you should know

**Video clips aren't guaranteed for every step.** The app reads the captions of real
repair videos to find where each step happens. Some videos have no captions, and some
jobs have no good video at all. When that happens the app tells you and shows the
written step. This is deliberate — a wrong clip is worse than no clip when you're
under a car.

**One honest caveat about captions.** Reading YouTube captions uses an unofficial
route, because YouTube's official API only lets you download captions for videos you
own yourself. It works, but YouTube can throttle requests coming from data centres. If
you notice clips drying up over time, that's the likely cause — the app falls back to
the chapter markers in video descriptions, which come from the official API and always
work. Nothing is ever downloaded or re-hosted; clips play in YouTube's own player, so
creators still get their views.

**It costs money per guide.** Roughly 5–20 cents of Anthropic credit per repair guide,
depending on how many steps and videos it reads. The YouTube part is free.

**Always verify safety-critical work.** This is AI-generated. For brakes, steering,
suspension, and fuel systems, check the torque specs against a service manual before
you trust them.

---

## Making changes later

**If you change the app** (colours, text, anything in `ai-mechanic/`): run the build
command again and reinstall.
```
cd ai-mechanic
npx eas-cli build --platform android --profile preview
```

**If you change the server** (anything in `server/`):
```
cd server
npx vercel --prod
```
The app picks up server changes immediately — no rebuild needed.

**To test the server logic without deploying:**
```
cd server
npm test
```

**To re-test a deployed server at any time:**
```
cd server
node test/ping.mjs https://YOUR-ADDRESS.vercel.app
```

---

## Troubleshooting

**"command not found: node" or "npm"**
Node.js didn't install, or your terminal is stale. Close the terminal, open a new one,
try `node --version` again. Reinstall Node.js if it still fails.

**The 3.4 test fails on step 1/2 with "ANTHROPIC_API_KEY is not set on the server"**
You skipped step 3.3, or you didn't run `npx vercel --prod` afterwards. Environment
variables only reach the server on the *next* deploy. Run `npx vercel --prod` again.

**The 3.4 test fails on step 2/2 with a 403 about YouTube**
Your Google key exists but the YouTube Data API isn't switched on for it. Go back to
Part 2.2 step 5–6 and make sure you clicked **Enable**, and that you were in the right
project when you created the key.

**The app says "Could not reach the server"**
The address in `eas.json` is wrong, or you edited it after building. Check it has no
trailing slash, starts with `https://`, and matches what `npx vercel --prod` printed.
Then rebuild the APK — the address is baked in at build time.

**The app says "This app does not know where its server is yet"**
You built before editing `eas.json`. Edit it (Part 4) and build again.

**Every step says "No video clip for this step"**
Run the 3.4 test again — it prints how many videos were searched. If it says
`searched 0 videos`, the YouTube key is the problem. If it searched several videos but
matched none, those videos had no captions or chapters; try a more common vehicle or a
more standard way of describing the job. For more detail, go to vercel.com, click your
project, click **Logs**, and look for a line starting with `videos error:`.

**The build fails with "Android Keystore" errors**
Run it again and answer `y` to generating a new keystore. If it still fails, run
`npx eas-cli credentials` and let it create one.

**Android won't install the APK**
You need to allow installs from that source (Part 5.3 step 3). Also make sure you have
about 100 MB free, and that you're not trying to install over a version signed with a
different key — if so, uninstall the old app first.

**Guides take longer than 60 seconds and then fail**
Vercel's free plan caps a request at 60 seconds. Try a narrower description ("replace
front brake pads" rather than "full brake job including lines and master cylinder").

**The app keeps asking me a question instead of writing a guide**
It does that when it cannot tell what vehicle you have, or the problem is too vague to
act on safely. Add the year, make and model, and say what the car is actually doing —
what noise, when, and from which end.

---

## Where things are, if you ever want to look

```
ai-mechanic/                     the phone app
  App.js                         main screen flow
  eas.json                       BUILD SETTINGS — your server address goes here
  src/api.js                     talks to your server
  src/screens/SetupScreen.js     the vehicle + repair form
  src/screens/GuideScreen.js     the step-by-step pages
  src/components/StepVideo.js    the embedded YouTube player
  src/theme.js                   all colours and text sizes

server/                          the backend
  api/guide.js                   asks Claude for the repair steps
  api/videos.js                  searches YouTube, matches steps to timestamps
  lib/youtube.js                 search, captions, chapter parsing
  lib/claude.js                  the Claude API call
  test/selftest.mjs              offline checks, run with: npm test
  test/ping.mjs                  tests a deployed server and both API keys
```
