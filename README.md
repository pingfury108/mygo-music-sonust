# Sonust for MyGo Music

把 [Sonust](https://github.com/pingfury108/sonust)（OpenSubsonic 服务端）接入 [MyGo Music](https://github.com/egoist/mygo-music) 的插件。

需要 MyGo Music **0.1.20 及以上**。

## 兼容性

- Sonust：[pingfury108/sonust](https://github.com/pingfury108/sonust)
- 协议：OpenSubsonic 1.16.1
- 认证：`apiKey`（`SONUST_API_KEY`，或 Sonust 首次启动打印的 key）
- 请求：全部 GET，不需要 `SONUST_PASSWORD` / `t/s` / `p=`
- 已在 Sonust 0.1.0（2026-11-09 更新，含 `getTopSongs`）与更早版本、MyGo Music 0.1.20 上使用

| 功能 | Sonust 接口 |
| --- | --- |
| 首页、专辑浏览 | `getAlbumList2`（newest / recent / starred / alphabeticalByName）、`getRandomSongs` |
| 收藏 | `getStarred2`、`star`、`unstar` |
| 歌手 | `getArtists`、`getArtist`、`getTopSongs` |
| 专辑、单曲 | `getAlbum`、`getSong` |
| 搜索 | `search3` |
| 歌单 | `getPlaylists`、`getPlaylist`、`createPlaylist`、`updatePlaylist`、`deletePlaylist` |
| 播放 | `stream` |
| 封面 | `getCoverArt` |
| 歌词 | `getLyricsBySongId` |
| 播放记录 | `scrobble` |

Sonust 目前为空或未实现的接口：播客、电台、评论、`getArtistInfo2`、书签/播放队列；插件不提供这些功能。

## 安装

一键安装：

```text
mygo-music://install-plugin?repo=pingfury108/mygo-music-sonust
```

或在 **设置 → 插件 → +** 里粘贴：

```text
https://github.com/pingfury108/mygo-music-sonust
```

本地安装时，把整个文件夹放到：

- 正式版 macOS：`~/Library/Application Support/MyGo Music/plugins/sonust/`
- 开发版 macOS：`~/Library/Application Support/MyGo Music Dev/plugins/sonust/`
- Linux：`~/.config/MyGo Music/plugins/sonust/`
- Windows：`%AppData%\MyGo Music\plugins\sonust\`

## 配置

打开 **设置 → 插件 → Sonust**：

- **服务器**：`http://<host>:4533`（不要带 `/rest` 或尾斜杠）
- **API Key**：Sonust 的 `SONUST_API_KEY`，或它首次启动打印的 key

然后在左下角切换到 Sonust。

## 功能

- 首页：随机卡片、最近添加、最近播放歌曲/专辑、收藏
- 专辑、歌手浏览；歌手页可切换歌曲和专辑
- 搜索歌曲、专辑、歌手、歌单
- 喜欢的歌曲、收藏的专辑、关注歌手
- 歌单创建、重命名、删除、加歌、移歌、排序
- 同步歌词、封面、原文件直传（FLAC 无损）
- 播放记录（`scrobble`）
- 中文/英文界面

## 限制

- `search3` 的歌曲只按标题匹配：搜歌手名时，歌手 Tab 有结果，歌曲 Tab 可能没有。
- 新版 Sonust 的 `getTopSongs` 已可用；旧版为空时，歌手页歌曲回退到最多 8 张专辑、最多 50 首。
- 封面：新版 Sonust 支持内嵌图 + `cover/folder/album/front.jpg/png` 目录图；旧版只提取内嵌图。
- 只显示同步歌词（`synced: true`）。
- 不支持 Opus；MyGo 0.1.20 只解 Ogg Vorbis。
- “最近播放歌曲”是插件本地历史（最多 30 首），不是 Sonust 接口。
- Sonust 是单用户服务端，所有歌单都视为“我的”。

## 日志

插件日志输出到 App 的 stderr。在 **设置 → 插件 → Sonust** 把 **调试日志** 填 `true`，再从终端启动：

```bash
"/Applications/MyGo Music.app/Contents/MacOS/MyGo Music"
```

终端会显示请求和耗时：

```text
plugin sonust: [sonust] -> getAlbum {"id":"al-130"}
plugin sonust: [sonust] <- getAlbum 549ms
```

## 仓库

- GitHub：[pingfury108/mygo-music-sonust](https://github.com/pingfury108/mygo-music-sonust)
- Topic：`mygo-music-plugin`
- License：MIT
