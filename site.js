/* ═══════════════════════════════════════════════════════════════
   site.js — content and behaviour shared by every page
   ────────────────────────────────────────────────────
   Home, About, Projects and Interests are four real pages that all
   load this one file. Everything you'd want to edit — posts,
   projects, publications, books, the carousel, the playlist — lives
   here, so there is still only one place to change any of it.

   Each render function returns early when its container is missing,
   which is how one script serves pages that show different sections.
═══════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   ██████╗  ██████╗ ███████╗████████╗███████╗
   ██╔══██╗██╔═══██╗██╔════╝╚══██╔══╝██╔════╝
   ██████╔╝██║   ██║███████╗   ██║   ███████╗
   ██╔═══╝ ██║   ██║╚════██║   ██║   ╚════██║
   ██║     ╚██████╔╝███████║   ██║   ███████║
   ╚═╝      ╚═════╝ ╚══════╝   ╚═╝   ╚══════╝

   HOW TO ADD A NEW POST
   ─────────────────────
   Copy one of the objects in the POSTS array and paste it
   at the TOP of the array (newest first). Fill in:

     date    → "YYYY-MM-DD"   used for sorting
     display → "Mon YYYY"     shown on the card
     title   → post title
     excerpt → 1–2 sentence teaser (shown on card)
     body    → full article content as an HTML string.
               Use <p> for paragraphs, <h2> for sections,
               <a href="..."> for links.

   Example:
   {
     date: "2026-03-17",
     display: "Mar 2026",
     title: "My New Post",
     excerpt: "A short teaser sentence.",
     body: `<p>First paragraph...</p><p>Second paragraph...</p>`
   },
════════════════════════════════════════════════════════════ */

const POSTS = [
  {
    slug: "janestreet-aug",
    date: "2026-08-07",
    display: "August 2026",
    title: "Jane Street ASIC Puzzle Solution",
    excerpt: "Writeup for the ASIC reverse engineering challenge posed by Jane Street in August.",
    body: `
      <p>This is a filler post and will be updated on or after September 4th.</p>
    `
  },
  {
    slug: "welcome",            // ← direct link: natthebag.github.io/#post-welcome
    date: "2025-07-26",
    display: "Jul 2025",
    title: "Welcome to my site",
    excerpt: "Getting started — a place to write about things I'm working on, thinking about, or learning.",
    body: `
      <p>This is the beginning of my personal site. I plan to use it to write about projects I'm working on,
      things I've learned, and ideas I'm thinking through.</p>
      <p>If you've found this and want to reach out, feel free to email me at
      <a href="mailto:hanlu0427@gmail.com">hanlu0427@gmail.com</a>.</p>
    `
  },
  
];
// NOTE: When adding a new post, include a slug — a short lowercase hyphenated
// ID, e.g. slug: "my-new-post" → links as natthebag.github.io/#post-my-new-post

/* ════════════════════════════════════════════════════════════
   ██████╗ ██████╗  ██████╗      ██╗███████╗ ██████╗████████╗███████╗
   ██╔══██╗██╔══██╗██╔═══██╗     ██║██╔════╝██╔════╝╚══██╔══╝██╔════╝
   ██████╔╝██████╔╝██║   ██║     ██║█████╗  ██║        ██║   ███████╗
   ██╔═══╝ ██╔══██╗██║   ██║██   ██║██╔══╝  ██║        ██║   ╚════██║
   ██║     ██║  ██║╚██████╔╝╚█████╔╝███████╗╚██████╗   ██║   ███████║
   ╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚════╝ ╚══════╝ ╚═════╝   ╚═╝   ╚══════╝

   HOW TO ADD A NEW PROJECT
   ────────────────────────
   Copy one of the objects below and add it to the array.
   Fill in:

     name    → project title
     status  → "ongoing" or "complete"
     desc    → 1–3 sentence description
     image   → URL to an image, or "" for placeholder
     links   → array of { label, url } objects (can be empty [])

   Example:
   {
     name: "My Robot Arm",
     status: "ongoing",
     desc: "A 4-DOF robotic arm built from scratch using servo motors and 3D-printed joints.",
     image: "",
     links: [
       { label: "GitHub", url: "https://github.com/natthebag/robot-arm" },
       { label: "Demo", url: "https://youtu.be/..." }
     ]
   },
════════════════════════════════════════════════════════════ */

const PROJECTS = [
  {
    name: "Robotics Club Competition Bot",
    status: "ongoing",
    desc: "Primary hardware designer for our school's FTC team for 3 years, leading our hardware team and assisting in software. ",
    image: "/figures/ftc.png",
    links: []
  },
  {
    name: "Convolution Neural Network Matrix Accelerator",
    status: "complete",
    desc: "For our BWSI Capstone project, we created a matrix multiplier and integrated that into a CNN accelerator by programming memory re-addressers and parallel MAC processes. Went through the full RTL to GDSII flow, expected tapeout Sept. 2026",
    image: "/figures/cnn.png",
    links:[
      {label: "SystemVerilog source file", url: "https://drive.google.com/file/d/1ExY5TptdJf2CDCwyN8SYbIh9Rj9XhtzK/view?usp=sharing"},
      {label: "Matrix Multiplier how-to", url: "https://bwsiasics.notion.site/"}
    ]
  },
  {
    name: "SmartWake Mini", 
    status: "ongoing",
    desc: "Created a wake-up timer based on movement during the night. Developed an algorithm that takes accelerometer data during the night and wakes you up when motion exceeds 90th percentile during the wake period, which is when sleep is lightest.",
    image: "/figures/smartwake.jpg",
    links: [
      
    ]
  },
  {
    name: "FTC Offseason Autonomous Drive Development",
    status: "ongoing",
    desc: "Developed a robot detection CV model on LimeLight and implemented it into a pathfinding algorithm for auto scoring while avoiding other robots.",
    image: "/figures/offseason_docs.png",
    links:[
      {label: "Documentation", url: "/src/ftc_offseason_docs.pdf"}
    ]
  },
  {
    name: "Science Bowl Evaluation Algorithm",
    status: "complete",
    desc: "Evaluated Science Bowl practice questions by embedding practice sets into vectors and extracting cluster concepts using K-means. From this, a practice website that is in progress was created.",
    image: "/figures/scibowl_class.png",
    links:[
      {label: "Website", url: "https://natthebag.github.io/scibowl/"},
      {label: "Sheet (figure on second sheet)", url: "https://docs.google.com/spreadsheets/d/1fbgxsfTC8Aesu3y8xYr4Y9aWwOZ3VnZKyBkKwof_8mY/edit?usp=sharing"}
    ]
  },
  {
    name: "ASIC Reverse Engineering", 
    status: "complete",
    desc: "Reverse-engineered an ASIC to solve the Jane Street challenge by extracting netlist from GDSII and running iverilog simulations.",
    image:"/figures/janestreet.png",
    links:[
      {label: "Solution Write-up", url: "https://natthebag.github.io/#post-janestreet-aug"}
    ]
  },

  {
    name: "3D Printing Curriculum",
    status: "ongoing",
    desc: "Created online CAD and design tutorials for team and public use. Presented in hardware and software workshops for our school community.",
    image: "/cad/interface.png",
    links: [
      { label: "Tutorial", url: "https://natthebag.github.io/cad"}
    ]
  },
  {
    name: "Pomodoro Timer",
    status: "complete",
    desc: "For the second capstone, our group created a pomodoro timer for focusing using FPGA and breadboard via Pmod interface.",
    image: "/figures/pomodoro.png",
    links: [
      { label: "Source File", url: "/src/workbreak2.v"}
    ]
  },
  {
    name: "Robotics Outreach",
    status: "ongoing",
    desc: "Mentored a FLL team in Kigali, Rwanda for 3 years, assisting them in design, programming, and presentation skills.",
    image: "/figures/workshop.png",
    links: [],
  },
  {
    name: "LaTeX Writer",
    status: "complete",
    desc: "Created tool to convert LaTeX to mouse inputs so that they can be created on any platform.",
    image: "/figures/latex.png",
    links:[
      {label: "Repository", url: "https://github.com/NatTheBag/LaTeX-for-Whiteboards/tree/master"},
    ],
  },
  {
    name: "MATLAB ARM Challenge",
    status: "complete",
    desc: "Participated in the MathWorks ARM Challenge, learning MATLAB's Robotics, Computer Vision, and Optimization toolboxes. Lent great understanding of MATLAB and Simulink, despite broken environment.",
    image: "/figures/arm.png",
    links: [],
  },
  {
      name: "Science Bowl Parser",
      status: "complete",
      desc: "Created a parsing script for the NSB (National Science Bowl) official practice sets for team practice and statistic aggregation. Source code coming soon!",
      image: "/figures/scibowl_parser.png",
      links: [
        { label: "Example Data", url: "https://docs.google.com/spreadsheets/d/1H5yYqJy9vRo-qf2FjsicQErGzZdf9KKcZ6Rw0_CoL-A/edit?usp=sharing"},
      ]
    },

  // {
  //   name: "3D Printing Curriculum",
  //   status: "complete",
  //   desc: "Developed and ran a multi-week workshop series teaching Autodesk Fusion 360 and FDM printing fundamentals to high school peers.",
  //   image: "",
  //   links: []
  // },
  // {
  //   name: "Robotics Outreach Program",
  //   status: "ongoing",
  //   desc: "Community program introducing K–8 students to engineering concepts through hands-on robot-building activities.",
  //   image: "",
  //   links: []
  // },
];

/* ════════════════════════════════════
   RENDER LOGIC — no need to edit below
════════════════════════════════════ */

function renderPosts() {
  const list = document.getElementById('post-list');
  if (!list) return;
  const sorted = [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = sorted.map((p) => `
    <li class="post-item" onclick="openPost(${POSTS.indexOf(p)})">
      <span class="post-icon">📝</span>
      <div class="post-text">
        <div class="post-meta">${p.display}</div>
        <div class="post-title">${p.title}</div>
        <p class="post-excerpt">${p.excerpt}</p>
      </div>
    </li>
  `).join('');
}

function renderProjects() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;
  grid.innerHTML = PROJECTS.map((p) => `
    <div class="xp-window item-window">
      <div class="xp-titlebar sm">
        <span class="xp-title-icon">▣</span>
        <span class="xp-title-text">${p.name}</span>
        <span class="xp-badge ${p.status === 'ongoing' ? 'work' : 'ok'}">${p.status}</span>
      </div>
      <div class="item-body">
        <div class="item-img-wrap">
          ${p.image
            ? `<img src="${p.image}" alt="${p.name}" loading="lazy" />`
            : `<div class="item-img-placeholder">No image</div>`
          }
        </div>
        <p class="item-desc">${p.desc}</p>
        ${p.links.length ? `
          <div class="item-links">
            ${p.links.map(l => `<a class="xp-button narrow" href="${l.url}" target="_blank">${l.label}</a>`).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

/* ── POST DIALOG ────────────────────── */
function openPost(idx) {
  const p = POSTS[idx];
  document.getElementById('modal-window-title').textContent = p.title + ' — Notepad';
  document.getElementById('modal-meta').textContent = p.display;
  document.getElementById('modal-title').textContent = p.title;
  document.getElementById('modal-body').innerHTML = p.body;
  document.getElementById('modal-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  addTask('task-post', '📝 ' + p.title, closeModal);
  setStatus('Opened: ' + p.title);
  // update URL hash so this post is directly linkable
  if (p.slug) history.replaceState(null, '', '#post-' + p.slug);
}

function copyPostLink() {
  const url = window.location.href.split('#')[0] + window.location.hash;
  navigator.clipboard.writeText(url).then(() => {
    const label = document.getElementById('copy-link-label');
    label.textContent = '✓ Copied!';
    setTimeout(() => { label.textContent = 'Copy link'; }, 2000);
  });
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  document.body.style.overflow = '';
  removeTask('task-post');
  setStatus('Done');
  // clear the hash without scrolling
  history.replaceState(null, '', window.location.pathname);
}

function closeModalBackdrop(e) {
  if (e.target === document.getElementById('modal-backdrop')) closeModal();
}

/* ════════════════════════════════════════════════════════════
    ██████╗ ██╗   ██╗██████╗ ███████╗
   ██╔══██╗██║   ██║██╔══██╗██╔════╝
   ██████╔╝██║   ██║██████╔╝███████╗
   ██╔═══╝ ██║   ██║██╔══██╗╚════██║
   ██║     ╚██████╔╝██████╔╝███████║
   ╚═╝      ╚═════╝ ╚═════╝ ╚══════╝

   HOW TO ADD A PUBLICATION
   ─────────────────────────
   Copy one object below and paste it at the TOP of the array.
   Fields:

     title    → full paper title
     authors  → author list string, use <strong>your name</strong> to highlight yourself
     year     → "2026"
     venue    → conference / journal name, e.g. "ICRA 2026"
     type     → "conference" | "journal" | "preprint" | "workshop"
     image    → path or URL to an image, or "" for no image
     abstract → paste the abstract here (plain text or HTML)
     comments → your personal notes (HTML string)
     links    → array of { label, url } (can be empty [])

   Example:
   {
     title: "Learning to Sequence Aircraft Arrivals with PPO",
     authors: "<strong>Han Lu</strong>, Jane Smith",
     year: "2026",
     venue: "AIAA Aviation Forum 2026",
     type: "conference",
     image: "/figures/paper_fig.png",
     abstract: "We present a reinforcement learning approach...",
     comments: `<p>This is the paper I wrote on my KSFO arrival sequencing project...</p>`,
     links: [
       { label: "PDF", url: "https://arxiv.org/..." },
       { label: "Code", url: "https://github.com/natthebag/..." },
     ]
   },
════════════════════════════════════════════════════════════ */

const PUBLICATIONS = [
  // ← paste your publications here
  // Remove this placeholder once you add real entries:
  {
    title: "Assessment of Rule-Based and Reinforcement Learning Control Methods with Evaluation of Reward Parameters in Terminal Space: Empirical Comparison Using ADS-B Data",
    authors: "<strong>Han Lu</strong>",
    year: "2026",
    venue: "",
    type: "preprint",
    image: "/figures/atc.png",
    abstract: "The aircraft landing problem (ALP), whose goal is to schedule airplane landings such that their landing times are consistent with legal separation minimums, poses a unique challenge to algorithm development because of its high stakes applications and its interaction with unideal human factors. Although both rule-based (RB) and reinforcement-learning-based (RL) solutions exist, evaluation of their effectiveness is often minimal. Similarly, philosophizing the impact of the implementation of these models is important and well-researched, yet is contingent on the effectiveness of such solutions. By constructing no-operation, human historical, rule-based, and reinforcement learning based models and assessing them against ADS-B data obtained from OpenSky, we are able to evaluate the effectiveness of these models in the real world. All models must adhere to the standard for zero separation violations to be valid, and their delays differ. The rule-based algorithm can achieve a 96% improvement in delay from historical human data, while the RL model differs in effectiveness based on reward tuning. We then used Bayesian optimization to tune these rewards to be close to historical, with the end goal of identifying the priorities of these models through the RL approach. We find the importance of not causing violations to be at least, quantitatively, 8.22 times as important as a successful landing and 71 times as important as not causing a delay.",
    comments: `<p> This is my first paper, and I hope you enjoy it! I will likely publish this properly when I am in college. </p>`,
    links: [
      {label: "Article", url: "https://doi.org/10.13140/RG.2.2.20163.16160"}
    ]
  },
];

/* ── PUB RENDER ──────────────────────── */
function renderPublications() {
  const list = document.getElementById('pub-list');
  if (!list) return;
  list.innerHTML = PUBLICATIONS.map((p, i) => `
    <div class="xp-window item-window clickable" onclick="openPub(${i})">
      <div class="xp-titlebar sm">
        <span class="xp-title-icon">◈</span>
        <span class="xp-title-text">${p.title}</span>
        <span class="xp-badge info">${p.type}</span>
      </div>
      <div class="item-body">
        <div class="item-img-wrap">
          ${p.image
            ? `<img src="${p.image}" alt="${p.title}" loading="lazy" />`
            : `<div class="item-img-placeholder">No image</div>`
          }
        </div>
        <div class="item-meta-row">
          <div class="pub-authors">${p.authors}</div>
          <div class="pub-venue">${p.venue ? p.venue + ' · ' : ''}${p.year}</div>
        </div>
        <div class="item-links">
          <span class="xp-button narrow">Open…</span>
        </div>
      </div>
    </div>
  `).join('');
}

/* ── PUB DIALOG ──────────────────────── */
function openPub(idx) {
  const p = PUBLICATIONS[idx];
  document.getElementById('pub-modal-window-title').textContent = p.title;
  document.getElementById('pub-modal-venue').textContent = (p.venue ? p.venue + ' · ' : '') + p.year;
  document.getElementById('pub-modal-title').textContent = p.title;

  let body = `<div class="pub-modal-authors">${p.authors}</div>`;

  if (p.abstract) {
    body += `<div class="pub-modal-section-label">Abstract</div>
             <div class="pub-modal-abstract">${p.abstract}</div>`;
  }
  if (p.comments) {
    body += `<div class="pub-modal-section-label">My Notes</div>
             <div class="pub-modal-comments">${p.comments}</div>`;
  }
  if (p.links && p.links.length) {
    body += `<div class="pub-modal-links">
      ${p.links.map(l => `<a class="xp-button narrow" href="${l.url}" target="_blank">${l.label}</a>`).join('')}
    </div>`;
  }

  document.getElementById('pub-modal-body').innerHTML = body;
  document.getElementById('pub-modal-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  addTask('task-pub', '📘 Publication', closePubModal);
  setStatus('Opened: publication');
}

function closePubModal() {
  document.getElementById('pub-modal-backdrop').classList.remove('open');
  document.body.style.overflow = '';
  removeTask('task-pub');
  setStatus('Done');
}

function closePubModalBackdrop(e) {
  if (e.target === document.getElementById('pub-modal-backdrop')) closePubModal();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closePubModal(); closeMsgBox(); closeStartMenu(); }
});

/* ════════════════════════════════════════════════════════════
   ███╗   ███╗██╗   ██╗███████╗██╗ ██████╗
   ████╗ ████║██║   ██║██╔════╝██║██╔════╝
   ██╔████╔██║██║   ██║███████╗██║██║
   ██║╚██╔╝██║██║   ██║╚════██║██║██║
   ██║ ╚═╝ ██║╚██████╔╝███████║██║╚██████╗
   ╚═╝     ╚═╝ ╚═════╝ ╚══════╝╚═╝ ╚═════╝

   HOW TO CHANGE THE PLAYLIST
   ──────────────────────────
   Paste any Spotify share link below. In Spotify: ⋯ → Share →
   Copy link. Playlists, albums, artists and single tracks all
   work, and so does the spotify:playlist:... URI form.

   The ?si=... tracking code Spotify tacks on the end is ignored,
   so you can paste the link exactly as it gives it to you.

   Set it to "" to hide the player entirely.
════════════════════════════════════════════════════════════ */

const PLAYLIST = "https://open.spotify.com/playlist/6FeoGgg57ZTq0W6EBg2dZj";

// how tall the embed is, in px. ~152 shows just the player bar,
// ~352 shows the player plus a scrollable track list.
const PLAYLIST_HEIGHT = 352;

/* ── PLAYER ──────────────────────────── */

// Pull the kind + id out of any Spotify link, ignoring the locale
// prefix (/intl-de/) and the ?si= share token.
function parseSpotify(link) {
  const m = String(link || '').match(
    /(?:open\.spotify\.com\/(?:intl-[a-z]{2}\/)?|spotify:)(playlist|album|track|artist|show|episode)[:/]([A-Za-z0-9]+)/i
  );
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const id   = m[2];
  return {
    kind, id,
    url:   `https://open.spotify.com/${kind}/${id}`,
    embed: `https://open.spotify.com/embed/${kind}/${id}`
  };
}

function renderPlaylist() {
  const frame  = document.getElementById('player-frame');
  if (!frame) return;
  const status = document.getElementById('player-status');
  const open   = document.getElementById('player-open');
  const item   = parseSpotify(PLAYLIST);

  if (!item) {
    frame.innerHTML = `<div class="player-empty">${
      PLAYLIST ? 'That doesn\'t look like a Spotify link.' : 'No playlist set.'
    }</div>`;
    status.textContent = 'Stopped';
    open.style.display = 'none';
    return;
  }

  frame.innerHTML = `<iframe
      src="${item.embed}?utm_source=generator"
      height="${PLAYLIST_HEIGHT}"
      style="border-radius:0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      title="Spotify ${item.kind}"></iframe>`;

  open.href = item.url;
  status.textContent = 'Ready — ' + item.kind.charAt(0).toUpperCase() + item.kind.slice(1);
}

/* ════════════════════════════════════════════════════════════
   ██████╗  ██████╗  ██████╗ ██╗  ██╗███████╗
   ██╔══██╗██╔═══██╗██╔═══██╗██║ ██╔╝██╔════╝
   ██████╔╝██║   ██║██║   ██║█████╔╝ ███████╗
   ██╔══██╗██║   ██║██║   ██║██╔═██╗ ╚════██║
   ██████╔╝╚██████╔╝╚██████╔╝██║  ██╗███████║
   ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝

   HOW TO ADD A BOOK
   ─────────────────
   Add an object to the BOOKS array below. Newest first — they
   show in the order you write them. Fill in:

     title   → the book's title
     author  → who wrote it
     thought → ONE sentence on what you made of it.
               Leave it as "" if you haven't decided yet — the
               row just shows a quiet placeholder until you do.

   Example:
   {
     title: "The Design of Everyday Things",
     author: "Don Norman",
     thought: "Made me notice every badly-placed door handle for a month."
   },
════════════════════════════════════════════════════════════ */

const BOOKS = [
  // ← add your books here, newest first. For example:
  // {
  //   title: "Structures: Or Why Things Don't Fall Down",
  //   author: "J. E. Gordon",
  //   thought: "The clearest explanation of why anything stands up that I've read."
  // },

  {
    title: "Amerika",
    author: "Franz Kafka",
    thought: "Currently reading..."
  },
  {
    title: "The Scarlet Letter",
    author: "Nathaniel Hawthorne",
    thought: "Fascinating depiction of shame..."
  },
  {
    title: "Tess of the D'Ubvervilles",
    author: "Thomas Hardy",
    thought: "'Justice' was done."
  },
  {
    title: "Lolita",
    author: "Vladimir Nabokov",
    thought: "Interesting perspective."
  },
  {
    title: "Candide",
    author: "Voltaire",
    thought: "Excellent use of our philosophy course..."
  },
  {
    title: "Sense and Sensibility",
    author: "Jane Austen",
    thought: "Favorite Austen book so far! Better than Pride & Prejudice."
  },
  {
    title: "The Bell Jar",
    author: "Sylvia Plath",
    thought: "Feels like I am going insane."
  },
  {
    title: "The Stranger",
    author: "Albert Camus",
    thought: "Read this on the plane... very strange"
  },
  {
    title: "Les Miserables",
    author: "Victor Hugo",
    thought: "A satisfying mixture of war descriptions and philosophical intrigue"
  },
  {
    title: "Thus Spoke Zarathustra",
    author: "Friedrich Nietzsche",
    thought: "'Of the Sublime Men' is my favorite section."
  },
  {
    title: "Madame Bovary",
    author: "Gustave Flaubert",
    thought: "Madame Bovary, c'est moi. (Flaubert)"
  },
  {
    title: "The Brothers Karamazov",
    author: "Fyodor Dostoevsky",
    thought: "Taking a Tolstoy break. The Grand Inquisitor section is splendid!"
  },
  {
    title: "Anna Karenina",
    author: "Leo Tolstoy",
    thought: "My favorite book... Excellent combination of social drama and stylistic flair."
  },
  {
    title: "War and Peace",
    author: "Leo Tolstoy",
    thought: "First really long novel I've read in a long time..."
  },
  {
    title: "White Nights",
    author: "Fyodor Dostoevsky",
    thought: "This book reinvigorated my interested in reading :)"
  }
];

/* ── BOOK RENDER ─────────────────────── */

// spine colours cycle so the list reads like a shelf
const SPINES = ['#8C1515', '#2a5c8f', '#3c7a3c', '#8a5a1a', '#5c3f74', '#286b6b'];

function renderBooks() {
  const list = document.getElementById('book-list');
  if (!list) return;

  if (!BOOKS.length) {
    list.innerHTML = `<li class="book-empty">No books listed yet.</li>`;
    return;
  }

  list.innerHTML = BOOKS.map((b, i) => `
    <li class="book-item">
      <span class="book-spine" style="--spine:${SPINES[i % SPINES.length]}"></span>
      <div class="book-text">
        <div class="book-title">
          ${b.title}${b.author ? ` <span class="book-author">— ${b.author}</span>` : ''}
        </div>
        <div class="book-thought${b.thought ? '' : ' empty'}">
          ${b.thought || 'No thoughts written down yet.'}
        </div>
      </div>
    </li>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   GALLERY — home page carousel
   ────────────────────────────
   Add images here. Each entry:

     image   → path to image file, e.g. "/figures/myproject.jpg"
     title   → caption title shown on hover
     sub     → small subtitle line (optional, e.g. "FTC 2025")

   Images auto-rotate every 4 seconds.
   Click the left half to go back, right half to go forward.

   Example:
   { image: "/figures/robot.jpg", title: "FTC Competition Bot", sub: "2025" },
════════════════════════════════════════════════════════════ */

const GALLERY = [
  { image: "/carousel/ftc2026.png", title: "FTC 2026 Competition Bot", sub: ""},
  { image: "/carousel/paper1.png", title: "ALP Publication", sub: "See Projects..."},
  { image: "/carousel/scibowl.png", title: "Science Bowl Classifier", sub: "See Projects..."},
  { image: "/carousel/servechassis.png", title: "Swerve Drive Chassis for FTC", sub: ""},
  { image: "/carousel/cnn.png", title: "CNN Accelerator Chip", sub: "Completed for BWSI Capstone"},
  { image: "/figures/offseason_docs.png", title: "Robot Identifier Computer Vision Model"},
  { image: "/carousel/smartwake-breadboard.jpg", title: "SmartWake Mini Breadboard"},
  { image: "/carousel/smartwake-hardware.png", title: "SmartWake Mini Hardware Map"},
];

/* ── CAROUSEL ────────────────────────── */
let carouselIdx = 0;
let carouselTimer = null;
let carouselSlides = [];

function buildCarousel() {
  const wrap = document.getElementById('carousel-wrap');
  if (!wrap) return;
  const dots = document.getElementById('carousel-dots');

  // insert slide divs before the click zones
  const prevZone = wrap.querySelector('.carousel-prev-zone');
  GALLERY.forEach((item, i) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide' + (i === 0 ? ' active' : '');
    slide.innerHTML = `<img src="${item.image}" alt="${item.title}" loading="${i === 0 ? 'eager' : 'lazy'}" />`;
    wrap.insertBefore(slide, prevZone);
    carouselSlides.push(slide);

    const dot = document.createElement('div');
    dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.title = item.title;
    dot.onclick = (e) => { e.stopPropagation(); carouselGoTo(i); };
    dots.appendChild(dot);
  });

  carouselUpdateCaption();
  carouselStartTimer();
}

function carouselGoTo(idx) {
  carouselSlides[carouselIdx].classList.remove('active');
  document.querySelectorAll('.carousel-dot')[carouselIdx].classList.remove('active');

  carouselIdx = (idx + GALLERY.length) % GALLERY.length;

  carouselSlides[carouselIdx].classList.add('active');
  document.querySelectorAll('.carousel-dot')[carouselIdx].classList.add('active');
  carouselUpdateCaption();
  carouselResetTimer();
}

function carouselStep(dir) {
  carouselGoTo(carouselIdx + dir);
}

function carouselUpdateCaption() {
  const item = GALLERY[carouselIdx];
  document.getElementById('carousel-title').textContent = item.title;
  document.getElementById('carousel-sub').textContent   = item.sub || (carouselIdx + 1) + ' of ' + GALLERY.length;
  const vt = document.getElementById('viewer-title');
  const file = item.image.split('/').pop();
  vt.textContent = file + ' — Windows Picture and Fax Viewer';
}

function carouselStartTimer() {
  carouselTimer = setInterval(() => carouselStep(1), 4000);
}

function carouselResetTimer() {
  clearInterval(carouselTimer);
  carouselStartTimer();
}

/* ════════════════════════════════════════════════════════════
   WINDOW CHROME — title bar buttons, taskbar, start menu, clock
════════════════════════════════════════════════════════════ */

function setStatus(text) {
  const el = document.getElementById('status-text');
  if (el) el.textContent = text;
}

/* main window minimize / maximize / close */
function minimizeMain() {
  document.getElementById('main-window').classList.add('minimized');
  document.getElementById('task-main').classList.remove('active');
  closeStartMenu();
}

function restoreMain() {
  document.getElementById('main-window').classList.remove('minimized');
  document.getElementById('task-main').classList.add('active');
}

function toggleMainWindow() {
  const win = document.getElementById('main-window');
  if (win.classList.contains('minimized')) restoreMain();
  else minimizeMain();
}

function toggleMaximize() {
  const win = document.getElementById('main-window');
  win.classList.remove('minimized');
  win.classList.toggle('maximized');
  document.getElementById('task-main').classList.add('active');
}

function attemptClose() {
  showMsgBox(
    'Internet Explorer',
    'This window cannot be closed.<br/>There are still robots to look at.',
    '✕'
  );
}

/* message box */
function showMsgBox(title, html, icon) {
  document.getElementById('msgbox-title').textContent = title;
  document.getElementById('msgbox-text').innerHTML = html;
  document.getElementById('msgbox-icon').textContent = icon || '!';
  document.getElementById('msgbox-backdrop').classList.add('open');
}
function closeMsgBox() {
  document.getElementById('msgbox-backdrop').classList.remove('open');
}

/* taskbar buttons for open dialogs */
function addTask(id, label, onClick) {
  if (document.getElementById(id)) return;
  const btn = document.createElement('button');
  btn.className = 'xp-task active';
  btn.id = id;
  btn.textContent = label;
  btn.onclick = onClick;
  document.getElementById('taskbar-tasks').appendChild(btn);
  document.getElementById('task-main').classList.remove('active');
}

function removeTask(id) {
  const btn = document.getElementById(id);
  if (btn) btn.remove();
  const main = document.getElementById('task-main');
  if (main && !document.querySelector('.xp-task.active')) main.classList.add('active');
}

/* start menu */
function toggleStartMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('start-menu');
  const btn  = document.getElementById('start-button');
  menu.classList.toggle('open');
  btn.classList.toggle('open', menu.classList.contains('open'));
}

function closeStartMenu() {
  document.getElementById('start-menu').classList.remove('open');
  document.getElementById('start-button').classList.remove('open');
}


document.addEventListener('click', e => {
  const menu = document.getElementById('start-menu');
  if (menu && menu.classList.contains('open') && !menu.contains(e.target)) closeStartMenu();
});

/* clock */
function tickClock() {
  const d = new Date();
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  document.getElementById('taskbar-clock').textContent = `${h}:${m} ${ampm}`;
}

/* ── INIT ─────────────────────────────── */
/* Each page loads this same script; the renderers above return early
   when their container is not in the document, so only the sections
   that page actually has get built. */
renderPosts();
renderProjects();
renderPublications();
renderBooks();
renderPlaylist();
buildCarousel();
tickClock();
setInterval(tickClock, 10000);

// the status bar reports what this page is showing
if (document.getElementById('book-list') && BOOKS.length) {
  setStatus(BOOKS.length + (BOOKS.length === 1 ? ' book' : ' books'));
}

// If URL contains #post-<slug>, open that post immediately
const hashMatch = window.location.hash.match(/^#post-(.+)$/);
if (hashMatch && document.getElementById('modal-backdrop')) {
  const slug = hashMatch[1];
  const idx = POSTS.findIndex(p => p.slug === slug);
  if (idx !== -1) openPost(idx);
}
