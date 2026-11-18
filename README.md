# 霓虹奔流 · Neon Rush

一款纯网页 3D 无尽跑酷游戏。低多边形 + 合成波（Synthwave）霓虹美学，全部场景资产由 Three.js 程序化生成，零图片/模型/音频素材文件。

## 运行

需通过本地 HTTP 服务打开（ES Module 不支持 `file://`）：

```bash
# 任选其一
npx serve .
node -e "const h=require('http'),f=require('fs'),p=require('path');const t={'.html':'text/html','.css':'text/css','.js':'text/javascript'};h.createServer((q,s)=>{let x=p.join(process.cwd(),q.url.split('?')[0]);if(x.endsWith('\\'))x=p.join(x,'index.html');f.readFile(x,(e,d)=>{if(e){s.writeHead(404);s.end();return}s.writeHead(200,{'Content-Type':t[p.extname(x)]||'application/octet-stream'});s.end(d)})}).listen(8137,()=>console.log('http://127.0.0.1:8137'))"
```

浏览器打开 `http://127.0.0.1:8137`。

## 玩法

自动向前奔跑，躲开障碍、收集水晶，跑得越远越快。

| 操作 | 键位 |
| --- | --- |
| 切换车道 | ← / → 或 A / D |
| 跳跃 | ↑ / W / 空格 |
| 快速下坠 | ↓ / S |
| 暂停 | P / Esc |
| 静音 | M |

触屏：左右滑动换道，上滑跳跃，下滑速降，点按也可跳跃。

### 规则

- **分数** = 距离分 + 水晶分。距离越远速度越快（13 → 30），难度同步提升。
- **连击**：3 秒内连续收集水晶，连击数累积；每 2 个水晶提升 0.5 倍得分（最高 x3.0）。
- **障碍**：粉色方块（换道躲）、横贯矮墙（跳）、深渊缺口（跳）、双车道高墙（留一条道）、横向巡逻方块（看时机）。
- **结束**：撞到障碍或坠入深渊。最高分存 localStorage。

## 结构

```
index.html        入口 + importmap 引入 three CDN
style.css         HUD 与界面样式
src/main.js       渲染循环、状态机、输入、相机、连击
src/world.js      赛道分段回收、霓虹背景、山、太阳、网格
src/player.js     低多边形角色、换道/跳跃/重力、死亡翻滚
src/obstacles.js  障碍与水晶的程序化生成、AABB 碰撞
src/effects.js    粒子池与相机震动
src/ui.js         HUD 与各界面、最高分存取
src/audio.js      WebAudio 合成音效（无素材文件）
```

## 调试钩子

`window.__neon` 暴露 `start()`、`step(dt)`、`keys.*`、`state()`，用于自动化测试与逐帧验证。
