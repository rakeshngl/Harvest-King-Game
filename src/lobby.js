import { PLAYER_PALETTE, SEASON_PRESETS } from './data.js'
import { t } from './i18n.js'
import { escapeHtml, fmtCount } from './format.js'
import { presetById } from './engine.js'
import { PERSONAS } from './ai.js'
import { todayKey } from './rng.js'
import { chromeToggleHtml, offlineBannerHtml } from './chrome.js'
import { rs } from './view-util.js'

export function presetLabel(id) {
  const p = presetById(id)
  return `${t('preset_' + p.id)} · ${t('seasonsN', p.seasons)}`
}

export function presetRowHtml({ id = 'presets', active, dataAttr = 'preset', label = true } = {}) {
  return `
    <div class="preset-row"${id ? ` id="${id}"` : ''}>
      ${label ? `<span class="preset-label">${t('matchLength')}</span>` : ''}
      ${SEASON_PRESETS.map((p) => `<button class="count-btn${p.id === active ? ' on' : ''}" data-${dataAttr}="${p.id}">${t('preset_' + p.id)}<small>${t('seasonsN', p.seasons)}</small></button>`).join('')}
    </div>`
}

export function statsHtml(hallStats) {
  return `
    <div class="hall-stats">
      <div class="stat">
        <b>${fmtCount(hallStats.visits)}</b>
        <span>${t('visited')}</span>
      </div>
      <div class="stat">
        <b>${fmtCount(hallStats.online)}</b>
        <span>${t('present')}</span>
      </div>
      <div class="stat">
        <b>${fmtCount(hallStats.playing)}</b>
        <span>${t('playing')}</span>
      </div>
    </div>`
}

export function mergeRecord(server, local) {
  const a = server || {}
  const b = local || {}
  if (!a.games && !b.games) return { games: 0, wins: 0, insolvencies: 0, bestNet: 0, recent: [] }
  return {
    games: (a.games || 0) + (b.games || 0),
    wins: (a.wins || 0) + (b.wins || 0),
    insolvencies: (a.insolvencies || 0) + (b.insolvencies || 0),
    bestNet: Math.max(a.bestNet || 0, b.bestNet || 0),
    recent: [...(a.recent || []), ...(b.recent || [])]
      .sort((x, y) => (y.at || 0) - (x.at || 0))
      .slice(0, 5)
  }
}

export function profileHtml(myProfile, local) {
  const p = mergeRecord(myProfile, local)
  if (!p.games) {
    return `
      <article class="mode-card record-card">
        <div class="mode-kicker">${t('myRecord')}</div>
        <h2>${t('myRecord')}</h2>
        <p>${t('recordEmpty')}</p>
        <p class="record-hint">${t('recordHint')}</p>
      </article>`
  }
  const rate = Math.round((p.wins / Math.max(1, p.games)) * 100)
  const rows = (p.recent || []).map((m) => `
    <div class="record-row">
      <span class="record-badge${m.won ? ' on' : ''}">${m.won ? t('recordWon') : t('recordPlayed')}</span>
      <span class="record-code">${m.code}</span>
      <span class="record-meta">${t('recordRank', m.rank, m.seats)}</span>
      <span class="record-net">${rs(m.net)}</span>
    </div>`).join('')
  return `
    <article class="mode-card record-card">
      <div class="mode-kicker">${t('myRecord')}</div>
      <h2>${t('myRecord')}</h2>
      <div class="record-stats">
        <div class="record-stat"><b>${fmtCount(p.games)}</b><span>${t('recordGames')}</span></div>
        <div class="record-stat"><b>${fmtCount(p.wins)}</b><span>${t('recordWins')}</span></div>
        <div class="record-stat"><b>${rate}%</b><span>${t('recordWins')}</span></div>
        <div class="record-stat"><b>${rs(p.bestNet)}</b><span>${t('recordBest')}</span></div>
        <div class="record-stat"><b>${fmtCount(p.insolvencies)}</b><span>${t('recordInsolvent')}</span></div>
      </div>
      ${rows ? `<div class="record-list"><div class="record-kicker">${t('recentMatches')}</div>${rows}</div>` : ''}
      <p class="record-hint">${t('recordHint')}</p>
    </article>`
}

export function openTablesHtml(openTables) {
  if (!openTables.length) {
    return `
      <article class="mode-card">
        <div class="mode-kicker">${t('hall')}</div>
        <h2>${t('openTables')}</h2>
        <p>${t('noOpen')}</p>
      </article>`
  }
  return `
      <article class="mode-card">
        <div class="mode-kicker">${t('hall')}</div>
        <h2>${t('openTables')}</h2>
        <p>${t('openHint')}</p>
        ${openTables.map((table) => `
          <div class="names">
            <span class="session-code" style="font-size:20px;padding:8px 12px">${table.code}</span>
            <span class="pcash">${table.seats}/4 · ${t('hostOf')} ${escapeHtml(table.host)} · ${presetLabel(table.preset)}</span>
            <button class="primary" data-halljoin="${table.code}">${t('sit')}</button>
          </div>`).join('')}
      </article>`
}

export function resumeTablesHtml(seats) {
  const codes = Object.keys(seats)
  if (!codes.length) return ''
  return `
      <article class="mode-card">
        <div class="mode-kicker">${t('thisDevice')}</div>
        <h2>${t('resumeTitle')}</h2>
        <p>${t('resumeHint')}</p>
        ${codes.map((code) => {
          const s = seats[code]
          const who = s.spectator ? t('watcher') : (s.name || t('farmer'))
          return `<div class="names">
            <span class="session-code" style="font-size:20px;padding:8px 12px">${escapeHtml(code)}</span>
            <button class="primary" data-resume="${escapeHtml(code)}">${t('resumeWho', escapeHtml(who))}</button>
            <button class="ghost" data-forget="${escapeHtml(code)}">${t('forget')}</button>
          </div>`
        }).join('')}
      </article>`
}

export function nameInputs(n) {
  return Array.from({ length: n }, (_, i) => {
    const pal = PLAYER_PALETTE[i]
    return `<input data-i="${i}" maxlength="16" placeholder="${pal.name}" style="border-color:${pal.color}" />`
  }).join('')
}

export function lobbyHtml({ lineOn, notice, hallStats, draftName, openTables, myProfile, local, presetChoice, seats }) {
  return `
  <div class="lobby">
    <header class="lobby-hero">
      <img src="/hero.webp" alt="Harvest King — Indian Farming Board Game" />
      <div class="hero-fade"></div>
    </header>
    <main class="lobby-table">
      ${chromeToggleHtml()}
      ${offlineBannerHtml(lineOn)}
      ${notice ? `<p class="notice">${escapeHtml(notice)}</p>` : ''}
      ${statsHtml(hallStats)}
      <div class="farmer-bar">
        <div>
          <div class="en">${t('takeSeat')}</div>
          <p>${t('takeSeatHint')}</p>
        </div>
        <input id="myname" maxlength="16" placeholder="${t('farmerName')}" value="${escapeHtml(draftName)}" required />
      </div>
      ${resumeTablesHtml(seats)}
      <div id="opentables">${openTablesHtml(openTables)}</div>
      <div id="myrecord">${profileHtml(myProfile, local)}</div>
      ${presetRowHtml({ active: presetChoice })}
      <div class="mode-grid">
        <article class="mode-card mode-online">
          <div class="mode-kicker">${t('onlineTable')}</div>
          <h2>${t('playFriends')}</h2>
          <p>${t('playFriendsHint')}</p>
          <input id="roompass" maxlength="24" placeholder="${t('password')}" />
          <button class="primary" id="create">${t('create')}</button>
          <div class="mode-split">${t('orJoin')}</div>
          <div class="names">
            <input id="joincode" maxlength="6" placeholder="ABCD" />
            <button class="primary" id="join">${t('join')}</button>
            <button class="ghost" id="watch">${t('watch')}</button>
          </div>
        </article>
        <article class="mode-card mode-cpu">
          <div class="mode-kicker">${t('solo')}</div>
          <h2>${t('vsCpu')}</h2>
          <p>${t('vsCpuHint')}</p>
          <div class="count-row" id="cpucounts">
            ${[2, 3, 4].map((n) => `<button class="count-btn${n === 2 ? ' on' : ''}" data-cpu="${n}">${n === 2 ? t('rival1') : t('rivalsN', n - 1)}</button>`).join('')}
          </div>
          <div class="count-row" id="cpudiff">
            ${['easy', 'normal', 'hard'].map((d) => `<button class="count-btn${d === 'normal' ? ' on' : ''}" data-diff="${d}">${t(d)}</button>`).join('')}
          </div>
          <button class="primary" id="vscpu">${t('playVsCpu')}</button>
        </article>
        <article class="mode-card mode-local">
          <div class="mode-kicker">${t('oneDevice')}</div>
          <h2>${t('passPlay')}</h2>
          <p>${t('passPlayHint')}</p>
          <div class="count-row" id="counts">
            ${[2, 3, 4].map((n) => `<button class="count-btn${n === 2 ? ' on' : ''}" data-n="${n}">${t('farmersN', n)}</button>`).join('')}
          </div>
          <div class="names" id="names">${nameInputs(2)}</div>
          <button class="primary" id="start">${t('passPlayBtn')}</button>
        </article>
        <article class="mode-card mode-daily">
          <div class="mode-kicker">${t('daily')}</div>
          <h2>${t('dailyTitle')}</h2>
          <p>${t('dailyHint', todayKey())}</p>
          <button class="primary" id="daily">${t('playDaily')}</button>
        </article>
      </div>
      <section class="guide">
        <header class="guide-head">
          <div class="en">${t('handbook')}</div>
          <h2>${t('howKing')}</h2>
          <p>${t('howKingLead')}</p>
        </header>
        <div class="guide-grid">
          <article class="guide-card">
            <div class="guide-num">01</div>
            <h3>${t('g1t')}</h3>
            <p>${t('g1')}</p>
          </article>
          <article class="guide-card">
            <div class="guide-num">02</div>
            <h3>${t('g2t')}</h3>
            <p>${t('g2')}</p>
          </article>
          <article class="guide-card">
            <div class="guide-num">03</div>
            <h3>${t('g3t')}</h3>
            <p>${t('g3')}</p>
          </article>
          <article class="guide-card">
            <div class="guide-num">04</div>
            <h3>${t('g4t')}</h3>
            <p>${t('g4')}</p>
          </article>
          <article class="guide-card">
            <div class="guide-num">05</div>
            <h3>${t('g5t')}</h3>
            <p>${t('g5')}</p>
          </article>
          <article class="guide-card">
            <div class="guide-num">06</div>
            <h3>${t('g6t')}</h3>
            <p>${t('g6')}</p>
          </article>
        </div>
        <div class="guide-strip">
          <div>
            <h4>${t('seasons')}</h4>
            <p>${t('seasonsP')}</p>
          </div>
          <div>
            <h4>${t('weather')}</h4>
            <p>${t('weatherP')}</p>
          </div>
          <div>
            <h4>${t('bank')}</h4>
            <p>${t('bankP')}</p>
          </div>
          <div>
            <h4>${t('infra')}</h4>
            <p>${t('infraP')}</p>
          </div>
        </div>
      </section>
    </main>
  </div>`
}

export function waitingHtml({ lineOn, notice, room, session }) {
  const players = (room && room.players) || []
  const hostSeat = room && Number.isInteger(room.hostSeat) ? room.hostSeat : 0
  const host = session && session.you === hostSeat
  const pal = PLAYER_PALETTE[session.you] || PLAYER_PALETTE[0]
  const origin = typeof location !== 'undefined' ? location.origin + location.pathname : ''
  const share = origin + '?join=' + (session ? session.code : '')
  return `
  <div class="lobby">
    <div class="lobby-card">
      ${chromeToggleHtml()}
      ${offlineBannerHtml(lineOn)}
      <div class="en">${t('waiting')}</div>
      <h1>${t('room')} ${session ? session.code : ''}</h1>
      <p class="lead">${t('waitingLead', !!(room && room.locked), pal.name, host)}</p>
      <div class="session-code">${session ? session.code : ''}</div>
      <p class="pcash" style="margin:8px 0 16px;word-break:break-all">${share}</p>
      <div class="waiting-list">
        ${players.map((p) => `
          <div class="player-card${p.seat === session.you ? ' turn' : ''}">
            <div class="swatch" style="background:${PLAYER_PALETTE[p.seat].color}"></div>
            <div>
              <div class="pname">${escapeHtml(p.name)}${p.cpu ? ' · ' + t('computer') : ''}${p.seat === hostSeat ? ' · ' + t('hostTag') : ''}${p.seat === session.you ? ' · ' + t('youTag') : ''}${!p.cpu && !p.connected ? ' · ' + t('away') : ''}</div>
              <div class="pcash">${p.cpu ? (PERSONAS.find((x) => x.id === p.persona)?.name || t('cpu')) : (p.connected ? t('seated') : t('away'))}</div>
              ${host && p.seat !== session.you ? `<div class="names" style="margin-top:8px">
                <button class="ghost" data-kick="${p.seat}">${t('remove')}</button>
                ${p.cpu ? '' : `<button class="ghost" data-host="${p.seat}">${t('makeHost')}</button>`}
              </div>` : ''}
            </div>
          </div>`).join('')}
        ${Array.from({ length: 4 - players.length }, (_, i) => `
          <div class="player-card" style="opacity:.45">
            <div class="swatch" style="background:#ccc"></div>
            <div class="pname">${t('openSeat', players.length + i + 1)}</div>
          </div>`).join('')}
      </div>
      ${notice ? `<p class="notice">${escapeHtml(notice)}</p>` : ''}
      ${host
        ? presetRowHtml({ id: 'onlinepreset', active: presetById(room && room.preset).id, dataAttr: 'onlinepreset' })
        : `<p class="pcash">${t('matchLength')}: ${presetLabel(room && room.preset)}</p>`}
      <div class="actions">
        ${host && players.length < 4 ? `<div class="count-row" id="onlinediff">
          ${['easy', 'normal', 'hard'].map((d) => `<button class="count-btn${d === (room.cpuDifficulty || 'normal') ? ' on' : ''}" data-onlinediff="${d}">${t(d)}</button>`).join('')}
        </div>
        <button class="ghost" id="addcpu">${t('addCpu')}</button>` : ''}
        ${host ? `<button class="primary" id="opengame" ${players.length < 2 ? 'disabled' : ''}>${t('startGame')}</button>` : '<p class="pcash">' + t('waitHost') + '</p>'}
        <button class="ghost" id="leave">${t('leave')}</button>
      </div>
    </div>
  </div>`
}
