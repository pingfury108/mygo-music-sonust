// Sonust as a source of MyGo Music.
//
// Sonust is an OpenSubsonic server: it has no per-user accounts, just one API
// key, so this plugin has no signIn/account: the server and the key are
// settings, and a request the server turns down asks for them to be fixed.
//
// Everything the app sees is mapped from the Subsonic shapes: durations are
// seconds there and milliseconds here, and a picture's size goes where the URL
// says {size}, which the app fills in.

const t = host.t;

const PAGE = 50;

// A request the server doesn't answer in this long is tried once more: the
// app gives a call 30 seconds, so two of these and a little still fit.
const REQUEST_TIMEOUT = 12000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function debugOn() {
  return String(host.setting("debug") || "").toLowerCase() === "true";
}

// log goes to the app's console, which is its stderr: run MyGo Music from a
// terminal to see it. The key never goes in a URL it logs.
function log(...parts) {
  if (!debugOn()) return;
  const text = parts.map((part) => (typeof part === "string" ? part : JSON.stringify(part))).join(" ");
  console.log("[sonust]", text);
}

function brief(params) {
  const out = {};
  Object.keys(params || {}).forEach((key) => {
    const value = params[key];
    out[key] = Array.isArray(value) ? `[${value.length}]` : String(value);
  });
  return out;
}

// What the app's player can decode, by the file's suffix. Opus is left out:
// the player reads Ogg Vorbis, not Opus.
const AUDIO = {
  mp3: "mp3",
  flac: "flac",
  wav: "wav",
  ogg: "ogg",
  m4a: "m4a",
  mp4: "m4a",
  aac: "aac",
};

// What a track's ID alone can't say when it's played after a restart: the
// type the player needs, and the size it may show.
const meta = new Map();

// The songs this run has seen, by ID, for the play history: the app says only
// the ID of what played, and the rest is here when it has.
const known = new Map();

function fail(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function settings() {
  const server = String(host.setting("server") || "").trim().replace(/\/+$/, "");
  const apiKey = String(host.setting("apiKey") || "").trim();
  if (!server || !apiKey) {
    throw fail("setup", t("Set the server and API key in this plugin's settings."));
  }
  if (!/^https?:\/\//i.test(server)) {
    throw fail("setup", t("The server address must start with http:// or https://."));
  }
  return { server, apiKey };
}

// url is a /rest call with the key, and the parameters of one, an array of
// values for a parameter that may come more than once.
function url(method, params) {
  const { server, apiKey } = settings();
  const q = new URLSearchParams();
  q.set("apiKey", apiKey);
  q.set("f", "json");
  q.set("v", "1.16.1");
  q.set("c", "MyGoMusic");
  Object.keys(params || {}).forEach((key) => {
    const value = params[key];
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v) => q.append(key, String(v)));
    } else {
      q.set(key, String(value));
    }
  });
  return `${server}/rest/${method}?${q.toString()}`;
}

// api asks the server, and answers the body of its subsonic-response, or
// throws what the app acts on: setup when the key is missing or turned down.
// A timeout or a connection that went away is tried once more: a slow moment
// of the server or the network shouldn't lose the page.
async function api(method, params, canRetry = true) {
  try {
    return await apiOnce(method, params);
  } catch (e) {
    if (!canRetry || !e || !e.retryable) throw e;
    log("retry", method);
    await sleep(350);
    return apiOnce(method, params);
  }
}

async function apiOnce(method, params) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  log("->", method, brief(params));
  try {
    const res = await fetch(url(method, params), {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    let body;
    try {
      body = await res.json();
    } catch {
      throw retryable(`${method}: ${t("the server didn't answer with JSON")}`);
    }
    const answer = body && body["subsonic-response"];
    if (!answer) {
      throw retryable(`${method}: ${t("not a Subsonic response")}`);
    }
    if (answer.status !== "ok") {
      const error = answer.error || {};
      const code = Number(error.code || 0);
      const message = error.message || `${t("error")} ${code}`;
      if (code === 40 || code === 41) {
        throw fail("setup", `${t("The server turned down the API key")}: ${message}`);
      }
      throw retryable(message, code === 0);
    }
    log("<-", method, `${Date.now() - started}ms`);
    return answer;
  } catch (e) {
    // Our own errors carry a string code; DOMException's AbortError carries a
    // numeric one, and must fall through to the timeout retry.
    if (e && typeof e.code === "string") {
      log("x", method, `${Date.now() - started}ms`, e.message);
      throw e;
    }
    const aborted = controller.signal.aborted || (e && e.name === "AbortError");
    const message = aborted
      ? `${method}: ${t("the server didn't answer in time")}`
      : `${t("Couldn't reach the server")}: ${e && e.message ? e.message : e}`;
    log("x", method, `${Date.now() - started}ms`, message);
    throw retryable(message);
  } finally {
    clearTimeout(timer);
  }
}

// retryable marks a failure that another try may get past, unlike a key the
// server turned down or a song it says it doesn't have.
function retryable(message, retry = true) {
  const e = fail("unavailable", message);
  e.retryable = retry;
  return e;
}

function cover(id) {
  if (!id) return undefined;
  try {
    return url("getCoverArt", { id, size: "{size}" });
  } catch {
    return undefined;
  }
}

function toArtist(a) {
  if (!a) return { id: "", name: "" };
  const artist = { id: a.id || "", name: a.name || "" };
  if (a.coverArt) artist.imageUrl = cover(a.coverArt);
  return artist;
}

function toAlbum(a) {
  const album = { id: a.id || "", name: a.name || "" };
  if (a.artist || a.artistId) {
    album.artists = [{ id: a.artistId || "", name: a.artist || "" }];
  }
  if (a.year) album.released = String(a.year);
  if (a.starred) album.saved = true;
  if (a.coverArt) album.imageUrl = cover(a.coverArt);
  return album;
}

function toPlaylist(p) {
  return {
    id: p.id,
    name: p.name || "",
    owner: p.owner || "",
    mine: true,
    trackCount: Number(p.songCount || 0),
  };
}

function toTrack(s, album) {
  const type = AUDIO[String(s.suffix || "").toLowerCase()] || "";
  const track = {
    id: s.id,
    name: s.title || "",
    duration: Math.round(Number(s.duration || 0) * 1000),
    artists: s.artist ? [{ id: s.artistId || "", name: s.artist }] : [],
    album: album
      ? { ...album }
      : toAlbum({ id: s.albumId, name: s.album, coverArt: s.coverArt }),
  };
  // The album's cover is where a track's is, and Sonust finds the first of
  // its files that has one; a track of its own only when the album has none.
  if (!track.album.imageUrl) {
    const art = s.albumId || s.coverArt;
    if (art) track.album.imageUrl = cover(art);
  }
  if (!type) track.unavailable = true;
  meta.set(s.id, { type, size: Number(s.size || 0) });
  known.set(s.id, s);
  if (meta.size > 5000) meta.delete(meta.keys().next().value);
  if (known.size > 5000) known.delete(known.keys().next().value);
  return track;
}

let starredCache = { at: 0, data: null };

async function starred() {
  if (starredCache.data && Date.now() - starredCache.at < 15000) {
    return starredCache.data;
  }
  const r = await api("getStarred2");
  const s = r.starred2 || {};
  const data = { songs: s.song || [], albums: s.album || [], artists: s.artist || [] };
  starredCache = { at: Date.now(), data };
  return data;
}

function forgetStarred() {
  starredCache = { at: 0, data: null };
}

// The songs played lately, as the server described them, kept through a
// restart. The app has no recent list of its own for a source that makes up
// its Home, so this is where one comes from.
function recentSongs() {
  const list = host.storage.get("recent");
  return Array.isArray(list) ? list : [];
}

async function remember(id) {
  let song = known.get(id);
  if (!song) {
    try {
      song = (await api("getSong", { id })).song;
    } catch {
      return;
    }
  }
  if (!song) return;
  const list = recentSongs().filter((s) => s && s.id !== id);
  list.unshift(song);
  host.storage.set("recent", list.slice(0, 30));
}

export function recent() {
  return recentSongs().map((s) => toTrack(s));
}

// Home: what was added or played lately, a shuffle, and what's starred. One
// section failing doesn't take the page with it, but every one failing, as
// with no key, does.

export async function home() {
  const jobs = [
    api("getAlbumList2", { type: "newest", size: 30 }),
    api("getAlbumList2", { type: "recent", size: 20 }),
    api("getRandomSongs", { size: 50 }),
    starred(),
  ];
  const settled = await Promise.all(
    jobs.map((job) => job.then((v) => ({ ok: true, v }), (e) => ({ ok: false, e })))
  );
  settled.forEach((s, i) => {
    if (!s.ok) log("home:", i, "failed:", s.e && s.e.message);
  });
  if (settled.every((s) => !s.ok)) throw settled[0].e;

  const newest = settled[0].ok ? settled[0].v.albumList2 || {} : {};
  const recent = settled[1].ok ? settled[1].v.albumList2 || {} : {};
  const random = settled[2].ok ? settled[2].v.randomSongs || {} : {};
  const stars = settled[3].ok ? settled[3].v : { songs: [], albums: [] };

  const sections = [];
  // A first section of tracks heads Home as the day's card, as MyGo means it.
  const picks = (random.song || []).slice(0, 30).map((s) => toTrack(s));
  if (picks.length) {
    sections.push({ title: t("Shuffle"), pageTitle: t("Shuffle"), tracks: picks });
  }
  const added = (newest.album || []).slice(0, 12).map(toAlbum);
  if (added.length) sections.push({ title: t("Recently added"), albums: added });
  const history = recentSongs().map((s) => toTrack(s)).slice(0, 8);
  if (history.length) sections.push({ title: t("Recently played songs"), tracks: history });
  const played = (recent.album || []).slice(0, 12).map(toAlbum);
  if (played.length) sections.push({ title: t("Recently played albums"), albums: played });
  const songs = stars.songs.slice(0, 12).map((s) => toTrack(s));
  if (songs.length) sections.push({ title: t("Starred songs"), tracks: songs });
  const albums = stars.albums.slice(0, 12).map(toAlbum);
  if (albums.length) sections.push({ title: t("Starred albums"), albums: albums });
  return { title: "Sonust", sections };
}

// The app's own pages don't list a whole library, so the sidebar gets two of
// the plugin's: every album by name, and every artist by first letter.

export async function browse({ page }) {
  const [kind, arg] = String(page || "").split(":");
  if (kind === "albums") {
    const skip = Math.max(0, Number(arg) || 0);
    const r = await api("getAlbumList2", { type: "alphabeticalByName", size: PAGE + 1, offset: skip });
    const found = (r.albumList2 && r.albumList2.album) || [];
    const more = found.length > PAGE;
    const section = { albums: found.slice(0, PAGE).map(toAlbum) };
    if (more) section.morePage = `albums:${skip + PAGE}`;
    return { title: t("Albums"), sections: [section] };
  }
  if (kind === "artists") {
    const r = await api("getArtists");
    const indexes = (r.artists && r.artists.index) || [];
    const sections = indexes
      .map((index) => ({ title: index.name, artists: (index.artist || []).map(toArtist) }))
      .filter((section) => section.artists.length);
    return { title: t("Artists"), sections };
  }
  throw fail("unavailable", t("No such page"));
}

export async function search({ query, kind, offset }) {
  const q = String(query || "");
  const skip = Math.max(0, Number(offset) || 0);
  const size = PAGE;

  if (kind === "playlists") {
    const r = await api("getPlaylists");
    const all = (r.playlists && r.playlists.playlist ? r.playlists.playlist : []).filter(
      (p) => !q || String(p.name || "").toLowerCase().includes(q.toLowerCase())
    );
    return { playlists: all.slice(skip, skip + size).map(toPlaylist), more: all.length > skip + size };
  }

  const params = { query: q };
  let key;
  if (kind === "tracks") {
    key = "song";
    params.songCount = size + 1;
    params.songOffset = skip;
    params.albumCount = 0;
    params.artistCount = 0;
  } else if (kind === "albums") {
    key = "album";
    params.albumCount = size + 1;
    params.albumOffset = skip;
    params.songCount = 0;
    params.artistCount = 0;
  } else if (kind === "artists") {
    key = "artist";
    params.artistCount = size + 1;
    params.artistOffset = skip;
    params.songCount = 0;
    params.albumCount = 0;
  } else {
    return { [kind]: [], more: false };
  }

  const r = await api("search3", params);
  const found = (r.searchResult3 && r.searchResult3[key]) || [];
  const page = found.slice(0, size);
  const result = { more: found.length > size };
  if (kind === "tracks") result.tracks = page.map((s) => toTrack(s));
  if (kind === "albums") result.albums = page.map(toAlbum);
  if (kind === "artists") result.artists = page.map(toArtist);
  return result;
}

export async function suggest({ query }) {
  if (!query) return [];
  const r = await api("search3", { query, songCount: 8, artistCount: 4, albumCount: 0 });
  const found = r.searchResult3 || {};
  const out = [];
  (found.artist || []).forEach((a) => out.push(a.name));
  (found.song || []).forEach((s) => out.push(s.title));
  return [...new Set(out)];
}

export async function liked({ offset }) {
  const data = await starred();
  const skip = Math.max(0, Number(offset) || 0);
  return {
    tracks: data.songs.slice(skip, skip + PAGE).map((s) => toTrack(s)),
    more: data.songs.length > skip + PAGE,
  };
}

export async function isLiked({ ids }) {
  const data = await starred();
  const set = new Set(data.songs.map((s) => s.id));
  const out = {};
  ids.forEach((id) => {
    out[id] = set.has(id);
  });
  return out;
}

export async function like({ id, on }) {
  await api(on ? "star" : "unstar", { id });
  forgetStarred();
}

// The app says a song played; Sonust keeps it for its frequent and recent
// lists. A failure isn't worth a dialog while the music plays.
export function played({ id }) {
  if (!id) return;
  remember(id);
  // Not retried: a scrobble that timed out may still have been recorded.
  return api("scrobble", { id, submission: "true" }, false).catch(() => {});
}

export async function album({ id }) {
  const r = await api("getAlbum", { id });
  const a = r.album || {};
  const found = toAlbum(a);
  return { album: found, tracks: (a.song || []).map((s) => toTrack(s, found)) };
}

export async function artist({ id }) {
  const r = await api("getArtist", { id });
  const a = r.artist || {};
  const found = { id: a.id, name: a.name };
  if (a.coverArt) found.imageUrl = cover(a.coverArt);
  let stars = { artists: [] };
  try {
    stars = await starred();
  } catch {}
  found.following = stars.artists.some((x) => x.id === a.id);
  const albums = (a.album || []).map(toAlbum);

  // Sonust has no top songs yet, its getTopSongs an empty answer. Ask for
  // them anyway, for when it does, and else read the songs of the artist's
  // albums: a page with a songs tab beats one without, even from some albums.
  let tracks = [];
  try {
    const top = await api("getTopSongs", { artist: a.name, count: 50 });
    tracks = ((top.topSongs && top.topSongs.song) || []).map((s) => toTrack(s));
  } catch {}
  if (!tracks.length && albums.length) {
    const pages = await Promise.all(
      (a.album || []).slice(0, 8).map((al) => api("getAlbum", { id: al.id }).catch(() => null))
    );
    const seen = new Set();
    pages.forEach((page) => {
      if (!page || !page.album) return;
      const hint = toAlbum(page.album);
      (page.album.song || []).forEach((s) => {
        if (seen.has(s.id)) return;
        seen.add(s.id);
        tracks.push(toTrack(s, hint));
      });
    });
    tracks = tracks.slice(0, 50);
  }
  return { artist: found, albums: albums, tracks: tracks };
}

export async function saveAlbum({ id, on }) {
  await api(on ? "star" : "unstar", { albumId: id });
  forgetStarred();
}

export async function savedAlbums({ offset }) {
  const skip = Math.max(0, Number(offset) || 0);
  const r = await api("getAlbumList2", { type: "starred", size: PAGE + 1, offset: skip });
  const albums = (r.albumList2 && r.albumList2.album) || [];
  return { albums: albums.slice(0, PAGE).map(toAlbum), more: albums.length > PAGE };
}

export async function followArtist({ id, on }) {
  await api(on ? "star" : "unstar", { artistId: id });
  forgetStarred();
}

export async function playlists() {
  const r = await api("getPlaylists");
  return (r.playlists && r.playlists.playlist ? r.playlists.playlist : []).map(toPlaylist);
}

export async function playlist({ id }) {
  const r = await api("getPlaylist", { id });
  const p = r.playlist || {};
  return { ...toPlaylist(p), tracks: (p.entry || []).map((s) => toTrack(s)) };
}

export async function createPlaylist({ name }) {
  const r = await api("createPlaylist", { name }, false);
  if (r.playlist) return { ...toPlaylist(r.playlist), tracks: [] };
  const all = await api("getPlaylists");
  const made = ((all.playlists && all.playlists.playlist) || []).filter((p) => p.name === name).pop();
  if (!made) throw fail("unavailable", t("The playlist wasn't created"));
  return { ...toPlaylist(made), tracks: [] };
}

export async function renamePlaylist({ id, name }) {
  await api("updatePlaylist", { playlistId: id, name });
}

export async function deletePlaylist({ id }) {
  await api("deletePlaylist", { id });
}

export async function addToPlaylist({ id, trackIds }) {
  // Not retried: a second try would add the songs twice.
  await api("updatePlaylist", { playlistId: id, songIdToAdd: trackIds }, false);
}

export async function removeFromPlaylist({ id, trackIds }) {
  const r = await api("getPlaylist", { id });
  const entries = (r.playlist && r.playlist.entry) || [];
  // Every copy of them: a playlist may hold a song more than once.
  const drop = new Set();
  entries.forEach((s, i) => {
    if (trackIds.includes(s.id)) drop.add(i);
  });
  const indexes = [...drop].sort((a, b) => b - a);
  if (indexes.length) {
    await api("updatePlaylist", { playlistId: id, songIndexToRemove: indexes }, false);
  }
}

// Subsonic has no move: the playlist is written again in its new order, which
// Sonust takes from createPlaylist with a playlistId.
export async function movePlaylistTrack({ id, from, to }) {
  const r = await api("getPlaylist", { id });
  const ids = ((r.playlist && r.playlist.entry) || []).map((s) => s.id);
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length || from === to) return;
  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved);
  await api("createPlaylist", { playlistId: id, songId: ids }, false);
}

export async function lyrics({ id }) {
  const r = await api("getLyricsBySongId", { id });
  const list = (r.lyricsList && r.lyricsList.structuredLyrics) || [];
  const first = list[0];
  const lines = first && Array.isArray(first.line) ? first.line.filter((l) => l.value) : [];
  if (!lines.length) throw fail("unavailable", t("No lyrics for this song"));
  // Untimed lyrics have nowhere to go on the lyric stage; the app shows none.
  if (!first.synced || !lines.some((l) => typeof l.start === "number")) {
    return { lines: [] };
  }
  return { lines: lines.map((l) => ({ start: Number(l.start || 0), text: l.value })) };
}

export async function stream({ id }) {
  let info = meta.get(id);
  if (!info || !info.type) {
    const r = await api("getSong", { id });
    const s = r.song || {};
    info = { type: AUDIO[String(s.suffix || "").toLowerCase()] || "", size: Number(s.size || 0) };
    meta.set(id, info);
  }
  if (!info.type) throw fail("unavailable", t("This song's format can't be played"));
  const out = { url: url("stream", { id }), type: info.type };
  if (info.size) out.size = info.size;
  return out;
}
