# Sonust for MyGo Music

把 [Sonust](https://github.com/pingfury108/sonust)（OpenSubsonic 服务端）接入 [MyGo Music](https://github.com/egoist/mygo-music) 的插件。

> 需要 MyGo Music **0.1.20 及以上**（封面 URL 的 `{size}` 占位符从该版本开始支持）。

## 针对的 Sonust 与兼容接口

本插件针对 **[pingfury108/sonust](https://github.com/pingfury108/sonust)** 编写，要求服务端为 **OpenSubsonic 1.16.1**，并使用 `apiKey` 认证（`SONUST_API_KEY`，或 Sonust 首次启动时打印的 key）。

实测环境：

| 项目 | 版本 / 说明 |
| --- | --- |
| Sonust | `main` @ `c0c66e8`，`serverVersion` 0.1.0 |
| MyGo Music | 0.1.20（macOS） |
| 协议 | OpenSubsonic 1.16.1，JSON，全部 GET |
| 认证 | 每个请求带 `apiKey`；不需要 `SONUST_PASSWORD`、`t/s` 或 `p=` |

> Sonust 的 `/rest/*` 目前只注册 GET；本插件所有请求也都是 GET。

### 用到的 Sonust 接口

| 用途 | 接口 | 本插件用法 |
| --- | --- | --- |
| 首页 / 专辑浏览 | `getAlbumList2` | `newest`、`recent`、`starred`、`alphabeticalByName`，带 `size`/`offset` |
| 随机卡片 | `getRandomSongs` | `size` |
| 喜欢的歌曲 / 收藏状态 | `getStarred2` | 全量取回，插件本地分页与 15s 缓存 |
| 歌手浏览 | `getArtists` / `getArtist` | 首字母索引、歌手专辑列表 |
| 专辑 / 单曲 | `getAlbum` / `getSong` | 专辑详情、播放格式与大小 |
| 搜索 | `search3` | 歌曲 / 专辑 / 歌手，`*Offset` 分页 |
| 热门歌曲 | `getTopSongs` | 当前 Sonust 返回空时，回退到该歌手专辑曲目 |
| 歌单 | `getPlaylists`、`getPlaylist`、`createPlaylist`、`updatePlaylist`、`deletePlaylist` | 列表、详情、增删、重命名、排序 |
| 收藏操作 | `star` / `unstar` | 歌曲 `id`、专辑 `albumId`、歌手 `artistId` |
| 播放 | `stream` | 原文件直传，支持 Range/206 |
| 封面 | `getCoverArt` | `size={size}`，由 App 决定 40/600 等尺寸 |
| 歌词 | `getLyricsBySongId` | `structuredLyrics`，使用同步歌词 |
| 播放记录 | `scrobble` | `submission=true` |

### 没有使用 / 不兼容的接口

| 接口 / 能力 | 原因 |
| --- | --- |
| `getPodcasts`、`getNewestPodcasts` | Sonust 返回空结果桩；插件不导出播客，界面自动隐藏 |
| `getInternetRadioStations` | Sonust 返回空结果桩；插件不导出电台 |
| 评论相关 | Sonust 未实现评论 |
| `getArtistInfo2` | 空结果；MyGo 的歌手页也不展示简介 |
| `getBookmarks`、`getPlayQueue` | MyGo 不使用 |
| v1 的 `search2`、`getAlbumList` | 插件使用 1.16.1 的 v2 接口 |
| `getCoverArt` 的 folder.jpg | Sonust 只提取内嵌封面；无内嵌图的专辑/歌手可能没有封面 |

### 兼容性限制

- `search3` 的歌曲只按标题匹配：搜歌手名时，歌手 Tab 有结果，歌曲 Tab 可能没有。
- `getTopSongs` 为空：歌手页歌曲回退到最多 8 张专辑、最多 50 首，不是按播放量排序。
- 歌词只有 `synced:true` 时才展示。
- 不支持 Opus（MyGo 0.1.20 只解 Ogg Vorbis）。
- “最近播放歌曲”是插件本地历史（最多 30 首），不是 Sonust 的接口。

## 安装

一键安装：

```text
mygo-music://install-plugin?repo=pingfury108/mygo-music-sonust
```

或在 **设置 → 插件 → +** 里粘贴：

```text
https://github.com/pingfury108/mygo-music-sonust
```

也可以任选一种本地方式：

1. **手动放入**（最快）：
   - 正式版：`~/Library/Application Support/MyGo Music/plugins/sonust/`
   - 开发版（`go tool mygo dev`）：`~/Library/Application Support/MyGo Music Dev/plugins/sonust/`
   - Linux：`~/.config/MyGo Music/plugins/sonust/`
   - Windows：`%AppData%\MyGo Music\plugins\sonust\`

   放好后重启 MyGo Music。也可以在 **设置 → 插件 → + → 显示插件文件夹** 里找到位置。
2. 把整个文件夹打成 zip，从 **设置 → 插件 → + → 从本机安装** 选它。
3. 发布到 GitHub 后，用 `mygo-music://install-plugin?repo=owner/repo` 安装。

## 第一次使用

1. 先启动 Sonust，确认浏览器能打开 `http://<host>:4533/rest/ping?apiKey=<key>`。
2. 打开 **设置 → 插件 → Sonust**，填写：
   - **服务器**：`http://<host>:4533`（不要带 `/rest`，不要带尾斜杠；挂在反代子路径下时填到子路径为止）
   - **API Key**：Sonust 的 `SONUST_API_KEY`，或它首次启动时打印的 key
3. 在左下角切换到 **Sonust** 音源。

不需要用户名密码：插件只用 `apiKey` 认证。Sonust 的 `t/s` token 和 `p=` 明文认证都不需要开启，也**不需要设置 `SONUST_PASSWORD`**。

## 支持的功能

| 页面 / 操作 | 数据来源 |
| --- | --- |
| Home（随机卡片、最近添加、最近播放歌曲、最近播放专辑、收藏） | `getAlbumList2`、`getRandomSongs`、`getStarred2`、本地播放历史 |
| 搜索歌曲 / 专辑 / 歌手 / 歌单 | `search3`（歌单在本地过滤） |
| 专辑页 | `getAlbum` |
| 歌手页（歌曲 + 专辑） | `getArtist`、`getTopSongs`，回退到最多 8 张专辑的 `getAlbum` |
| 喜欢的歌曲 | `getStarred2` + `star` / `unstar` |
| 收藏专辑 | `star` / `unstar` + `getAlbumList2?type=starred` |
| 关注歌手 | `star` / `unstar`（`artistId`） |
| 歌单增删改、排序 | `getPlaylists`、`getPlaylist`、`createPlaylist`、`updatePlaylist`、`deletePlaylist` |
| 播放 | `/rest/stream`，直传原文件，FLAC / WAV 无损 |
| 封面 | `getCoverArt`，带 `size={size}` 由 App 缩放 |
| 歌词 | `getLyricsBySongId`（仅同步歌词） |
| 播放记录 | `scrobble` |

侧边栏：Home、专辑、歌手、喜欢的歌曲、收藏的专辑，以及 App 自动列出的歌单。

## 超时与日志

- 每个 API 请求 12 秒超时，失败重试 1 次，总时长控制在 App 的 30 秒调用上限内；远端偶尔停顿不会直接让页面失败。
- 插件没有自己的日志文件，`console.log` 会进 App 的 stderr。想看日志：在 **设置 → 插件 → Sonust** 把 **调试日志** 填 `true`，然后从终端启动 App：

  ```bash
  "/Applications/MyGo Music.app/Contents/MacOS/MyGo Music"
  ```

  终端会输出 `plugin sonust: [sonust] -> getAlbum {"id":"al-130"}` 这样的请求/耗时行。用不到时把调试日志清空即可。

## 已知限制

- **搜索**：Sonust 的 `search3` 只按歌曲标题、专辑名、歌手名匹配（歌曲不会按歌手/专辑名搜到）。
- **歌手页的歌曲是回退结果**：Sonust 的 `getTopSongs` 目前返回空，插件改从该歌手前 8 张专辑取歌（最多 50 首）；不是按播放量排序的热门歌。
- **非同步歌词不显示**：MyGo 的歌词舞台需要时间轴；Sonust 返回 `synced:false` 时插件返回空歌词。
- **Opus 不播放**：MyGo 0.1.20 只解 Ogg Vorbis；插件会把 `.opus` 标记为不可播放。MP3 / FLAC / WAV / OGG(Vorbis) / M4A(ALAC/AAC) / AAC 正常。
- **没有播客、电台、评论**：Sonust 这些端点是空结果，插件不导出对应功能。
- **所有歌单都视为“我的”**：Sonust 是单用户服务端。
- **“最近播放歌曲”是插件本地历史**：存在 MyGo 的插件数据里，最多 30 首；换设备或清插件数据就没了。Sonust 本身没有“最近播放歌曲”端点。
- **网络权限是 `*`**：MyGo 的 `network` 权限不支持用设置动态填 host，而服务器地址是可配置的。固定服务器后可以把它改成 `"192.168.1.10"` 这样的主机名（端口会被忽略）。
- **API Key 在封面/音频 URL 的查询串里**：Sonust 的日志会对 `apiKey` 脱敏，但反向代理日志可能不会。公网使用请上 HTTPS，并避免把带 key 的 URL 分享出去。
- **自签 HTTPS 证书**会被 App 的 fetch 拒绝；内网可先用 HTTP，或给反代配可信证书。
- **不使用 Sonust 的预转码 MP3 镜像**：插件直传原文件（FLAC 无损）。公网弱网想省流量时，可以改 `stream` 请求 `format=mp3`，但 Sonust 没有“镜像是否已生成”的查询接口，无镜像时会退回原文件，类型/无损标识需要自己处理。

## 与现成 Subsonic 插件的区别

社区已有 `TexasOct/mygo-subsonic`（功能更全：多地址回退、专辑/歌手浏览、扫描状态、密码登录）。它默认用 **POST** 调 `/rest`，而 Sonust 只注册了 **GET** 路由，直接安装会在登录时得到 `HTTP 405`。把它的请求改成 GET 后可正常工作（已实测），但它需要 `SONUST_PASSWORD` + 用户名，且密码会明文保存在 MyGo 设置里。

本插件更小（约 581 行）、只用 `apiKey`、请求全部是 GET，针对 Sonust 的 ID / 封面 / 歌单行为做了适配。功能取舍见上表。

## 开发与验证

插件不需要构建：`plugin.json` + `index.js`（ESM）即可，MyGo 用 moejs 直接编译运行。

本地验证方式：

```bash
# 1) 起一个 Sonust
SONUST_API_KEY=testkey SONUST_PASSWORD=testpass ./target/release/sonust \
  --music-dir ~/Music --data-dir /tmp/sonust-data --port 4533 serve

# 2) 用 Node 直接加载插件（需要 stub 一个 host 全局）
node your-test.mjs
```

本次实现已通过：

- Node mock 服务端：29 个请求，覆盖 home/search/paging/album/artist/liked/playlists（含 move/remove）/lyrics/stream/错误码。
- MyGo 真实插件运行时（moejs）集成测试：`home`、`browse`、`search`、`album`、`artist`、`playlist`、`stream`、`lyrics`、`played`，以及错误 key → `setup`。
- 对真实 Sonust（0.1.0 编译版、两首歌的测试库）跑通：apiKey 认证、封面缩放、FLAC 直传、歌单增删改排序、scrobble、同步歌词。

## 仓库与收录

- GitHub：[pingfury108/mygo-music-sonust](https://github.com/pingfury108/mygo-music-sonust)
- 已加 topic `mygo-music-plugin`，用于 MyGo 官方插件页收录
- License: MIT

## 发布

`plugin.json` 在仓库根目录；Release `v0.1.0` 附一个不带平台名的 `mygo-music-sonust.zip`，MyGo 会优先取它，否则取默认分支源码。`mygo-music://install-plugin?repo=pingfury108/mygo-music-sonust` 可直接做安装按钮。
