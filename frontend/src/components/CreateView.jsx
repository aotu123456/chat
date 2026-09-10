import { useState } from 'react';
import { api } from '../api';
import {
  defaultWorld,
  newChar,
  sanitizeChar,
  sanitizeWorld,
  setByPath,
} from '../utils';

function TextInput({ value, onChange, placeholder, maxLength, title, style }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      placeholder={placeholder}
      maxLength={maxLength}
      title={title}
      style={style}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 2 }) {
  return (
    <textarea
      value={value ?? ''}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {options.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  );
}

function Field({ label, tag, children }) {
  return (
    <div className="form-row">
      <label>
        {label}
        {tag}
      </label>
      {children}
    </div>
  );
}

function TwoCol({ a, b }) {
  return (
    <div className="form-row two-col">
      <div>{a}</div>
      <div>{b}</div>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div className="form-block">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function ErrorBar({ id, errors }) {
  if (!errors.length) return null;
  return (
    <div id={id} className="error-bar">
      {errors.map((item, index) => <div key={`${id}-error-${index}`}>• {item}</div>)}
    </div>
  );
}

function FormSection({ num, title, right, children }) {
  const [closed, setClosed] = useState(false);
  return (
    <section className={`form-section${closed ? ' closed' : ''}`}>
      <h2 className="sec-head" onClick={() => setClosed((value) => !value)}>
        <span>{num}</span> {title} {right}
        <button type="button" className="btn tiny sec-toggle">
          {closed ? '展开' : '收起'}
        </button>
      </h2>
      {!closed && <div className="sec-body">{children}</div>}
    </section>
  );
}

function KvListEditor({ rows, onChange, keyPlaceholder, valuePlaceholder }) {
  const list = rows || [];

  const updateRow = (index, key, value) => {
    onChange(list.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  return (
    <>
      <div className="list-rows">
        {list.map((row, index) => (
          <div className="list-row" key={`kv-${index}`}>
            <input
              type="text"
              value={row.k || ''}
              placeholder={keyPlaceholder}
              onChange={(e) => updateRow(index, 'k', e.target.value)}
            />
            <input
              type="text"
              value={row.v ?? ''}
              placeholder={valuePlaceholder}
              onChange={(e) => updateRow(index, 'v', e.target.value)}
            />
            <button
              type="button"
              className="btn danger tiny row-del"
              onClick={() => onChange(list.filter((_, i) => i !== index))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn tiny add-row-btn"
        onClick={() => onChange([...list, { k: '', v: '' }])}
      >
        ＋ 添加
      </button>
    </>
  );
}

function ObjListEditor({ rows, fields, onChange, addLabel }) {
  const list = rows || [];

  const updateRow = (index, key, value) => {
    onChange(list.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  return (
    <>
      <div className="list-rows">
        {list.map((row, index) => (
          <div className="list-row" key={`obj-${index}`}>
            {fields.map((field) => (
              <input
                type="text"
                key={field.k}
                value={row[field.k] ?? ''}
                placeholder={field.ph}
                onChange={(e) => updateRow(index, field.k, e.target.value)}
              />
            ))}
            <button
              type="button"
              className="btn danger tiny row-del"
              onClick={() => onChange(list.filter((_, i) => i !== index))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn tiny add-row-btn"
        onClick={() => onChange([...list, Object.fromEntries(fields.map((field) => [field.k, '']))])}
      >
        ＋ {addLabel}
      </button>
    </>
  );
}

function CharacterEditor({ char, isPlayer, onChange, onDelete, confirmDialog }) {
  const [closed, setClosed] = useState(false);
  const set = (path, value) => onChange(path, value);

  const handleDelete = async (e) => {
    e.stopPropagation();
    const ok = await confirmDialog('删除角色', `确认删除「${char.name || '未命名'}」?`);
    if (ok) onDelete();
  };

  const publicTag = <span className="visibility-tag public">智能体可见</span>;
  const privateTag = (
    <span className="visibility-tag private">
      {isPlayer ? 'AI 不可见 ⚠️' : '仅自己知道'}
    </span>
  );

  return (
    <div className="char-editor">
      <div className="char-head" onClick={() => setClosed((value) => !value)}>
        <input
          type="text"
          className="char-avatar"
          style={{ width: 48, textAlign: 'center', fontSize: 18, padding: 4 }}
          maxLength={4}
          title="头像 emoji"
          value={char.avatar || ''}
          onChange={(e) => set('avatar', e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
        <input
          type="text"
          style={{ flex: 1, minWidth: 60 }}
          placeholder="角色名 *"
          value={char.name || ''}
          onChange={(e) => set('name', e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
        <span className="char-sub">
          {isPlayer ? '扮演角色 · AI 只见公开信息' : 'NPC'}
        </span>
        <button type="button" className="btn tiny ghost">
          {closed ? '▸' : '▾'}
        </button>
        {!isPlayer && (
          <button
            type="button"
            className="btn danger tiny char-del"
            onClick={handleDelete}
          >
            🗑
          </button>
        )}
      </div>

      {!closed && (
        <div className="char-body">
          <Block title="身份">
            <TwoCol
              a={(
                <Field label="称号">
                  <TextInput value={char.title} onChange={(v) => set('title', v)} placeholder="如:圣殿骑士" />
                </Field>
              )}
              b={(
                <Field label="种族">
                  <TextInput value={char.race} onChange={(v) => set('race', v)} placeholder="人类/精灵..." />
                </Field>
              )}
            />
            <TwoCol
              a={(
                <Field label="职业">
                  <TextInput value={char.occupation} onChange={(v) => set('occupation', v)} placeholder="骑士/法师..." />
                </Field>
              )}
              b={(
                <Field label="年龄">
                  <TextInput value={char.age} onChange={(v) => set('age', v)} placeholder="28" />
                </Field>
              )}
            />
            <Field label="性别">
              <TextInput value={char.gender} onChange={(v) => set('gender', v)} placeholder="男/女/其他" />
            </Field>
          </Block>

          <Block title="公开区(他人可直接感知)">
            <Field
              label={<>外貌描述 <span className="req">*</span></>}
              tag={publicTag}
            >
              <TextArea
                value={char.public.appearance}
                onChange={(v) => set('public.appearance', v)}
                placeholder="银甲红披风,左颊一道旧疤"
                rows={2}
              />
            </Field>
            <Field label="说话风格">
              <TextInput
                value={char.public.speech_style}
                onChange={(v) => set('public.speech_style', v)}
                placeholder="正式庄重,多用敬语"
              />
            </Field>
            <Field label="性格标签">
              <TextInput
                value={char.public.personality}
                onChange={(v) => set('public.personality', v)}
                placeholder="忠诚,严肃,固执"
              />
            </Field>
            <Field label="公开背景">
              <TextInput
                value={char.public.public_background}
                onChange={(v) => set('public.public_background', v)}
                placeholder="晨曦王国资深骑士"
              />
            </Field>
            <Field label="外显特征(属性/体型/气势)">
              <KvListEditor
                rows={char.public.public_attributes}
                onChange={(rows) => set('public.public_attributes', rows)}
                keyPlaceholder="键(如:气势)"
                valuePlaceholder="值(如:8)"
              />
            </Field>
          </Block>

          <Block title="私密区(他人无法感知)">
            <Field
              label="真实背景"
              tag={privateTag}
            >
              <TextArea
                value={char.private.background}
                onChange={(v) => set('private.background', v)}
                placeholder="曾是王太子卫队,因阴谋被贬"
                rows={2}
              />
            </Field>
            <Field label="目标">
              <TextInput
                value={char.private.goals}
                onChange={(v) => set('private.goals', v)}
                placeholder="洗清冤屈,重获信任"
              />
            </Field>
            <Field label="秘密">
              <TextArea
                value={char.private.secrets}
                onChange={(v) => set('private.secrets', v)}
                placeholder="目击了老国王被毒杀的真相"
                rows={2}
              />
            </Field>
            <Field label="全量属性">
              <KvListEditor
                rows={char.private.attributes}
                onChange={(rows) => set('private.attributes', rows)}
                keyPlaceholder="键(如:力量)"
                valuePlaceholder="值(如:12)"
              />
            </Field>
            <Field label="技能">
              <TextInput
                value={char.private.skills}
                onChange={(v) => set('private.skills', v)}
                placeholder="剑术,骑术,军略"
              />
            </Field>
            <Field label="随身物品">
              <ObjListEditor
                rows={char.private.inventory}
                fields={[{ k: 'name', ph: '物品名' }, { k: 'desc', ph: '描述' }]}
                onChange={(rows) => set('private.inventory', rows)}
                addLabel="添加物品"
              />
            </Field>
          </Block>

          <Block title="初始状态">
            <TwoCol
              a={(
                <Field label="情绪">
                  <TextInput value={char.status.emotion} onChange={(v) => set('status.emotion', v)} placeholder="坚定" />
                </Field>
              )}
              b={(
                <Field label="位置">
                  <TextInput value={char.status.location} onChange={(v) => set('status.location', v)} placeholder="村庄广场" />
                </Field>
              )}
            />
            <TwoCol
              a={(
                <Field label="HP">
                  <TextInput value={char.status.hp} onChange={(v) => set('status.hp', v)} placeholder="100" />
                </Field>
              )}
              b={(
                <Field label="MP">
                  <TextInput value={char.status.mp} onChange={(v) => set('status.mp', v)} placeholder="0" />
                </Field>
              )}
            />
          </Block>

          <Block title="与其他角色的关系">
            <KvListEditor
              rows={char.relationships}
              onChange={(rows) => set('relationships', rows)}
              keyPlaceholder="角色id"
              valuePlaceholder="关系描述"
            />
          </Block>
        </div>
      )}
    </div>
  );
}

const TIME_OPTIONS = ['清晨', '上午', '中午', '下午', '傍晚', '夜晚'];

export default function CreateView({ onBack, onCreated, showToast, confirmDialog }) {
  const [form, setForm] = useState(() => ({
    name: '',
    synopsis: '',
    world: defaultWorld(),
    characters: [newChar()],
    player: newChar('', '🧙'),
  }));
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const updateWorld = (path, value) => {
    setForm((prev) => ({ ...prev, world: setByPath(prev.world, path, value) }));
  };

  const updateChar = (index, path, value) => {
    setForm((prev) => {
      const characters = prev.characters.slice();
      characters[index] = setByPath(characters[index], path, value);
      return { ...prev, characters };
    });
  };

  const updatePlayer = (path, value) => {
    setForm((prev) => ({ ...prev, player: setByPath(prev.player, path, value) }));
  };

  const addChar = () => {
    setForm((prev) => ({ ...prev, characters: [...prev.characters, newChar()] }));
  };

  const removeChar = (index) => {
    setForm((prev) => ({
      ...prev,
      characters: prev.characters.filter((_, i) => i !== index),
    }));
  };

  const submit = async () => {
    const nextErrors = [];
    if (!form.name.trim()) nextErrors.push('请填写存档名称');
    if (!form.world.name.trim()) nextErrors.push('请填写世界名称');
    if (!form.world.history.trim()) nextErrors.push('请填写世界历史背景');
    if (!form.player.name.trim()) nextErrors.push('请填写你的角色名');
    if (!(form.player.public.appearance || '').trim()) nextErrors.push('你的角色缺少公开外貌描述');
    if (!form.characters.length) nextErrors.push('至少需要一个 NPC 角色');

    for (const c of form.characters) {
      if (!c.name.trim()) { nextErrors.push('存在未命名的角色'); break; }
      if (!(c.public.appearance || '').trim()) nextErrors.push(`角色「${c.name}」缺少公开外貌描述`);
    }

    if (nextErrors.length) {
      setErrors(nextErrors);
      return;
    }

    const payload = {
      name: form.name.trim(),
      synopsis: form.synopsis.trim() || form.world.name.trim(),
      world: sanitizeWorld(form.world),
      characters: form.characters.map(sanitizeChar),
      player: sanitizeChar(form.player),
    };

    setSubmitting(true);
    setErrors([]);
    try {
      const res = await api('/api/sessions', { method: 'POST', body: payload });
      showToast('存档已创建');
      await onCreated(res.id);
    } catch (e) {
      setErrors([e.message]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="view-create" className="view">
      <header className="page-header">
        <button type="button" className="btn ghost" id="btn-back-from-create" onClick={onBack}>
          ← 返回
        </button>
        <h1 className="page-title">✨ 创建新存档</h1>
        <span></span>
      </header>

      <main className="create-main">
        <ErrorBar id="create-errors" errors={errors} />

        <FormSection num="①" title="基础信息">
          <Field label={<>存档名称 <span className="req">*</span></>}>
            <TextInput
              value={form.name}
              onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
              placeholder="如:晨曦镇的第一天"
              maxLength={30}
            />
          </Field>
          <Field label="简介">
            <TextInput
              value={form.synopsis}
              onChange={(value) => setForm((prev) => ({ ...prev, synopsis: value }))}
              placeholder="一句话概括这次冒险(留空则用世界名)"
            />
          </Field>
        </FormSection>

        <FormSection num="②" title="世界设定">
          <Block title="▸ 总览">
            <Field label={<>世界名称 <span className="req">*</span></>}>
              <TextInput value={form.world.name} onChange={(value) => updateWorld('name', value)} maxLength={30} />
            </Field>
            <Field label="简介">
              <TextArea value={form.world.description} onChange={(value) => updateWorld('description', value)} rows={2} />
            </Field>
            <TwoCol
              a={(
                <Field label="题材">
                  <TextInput value={form.world.genre} onChange={(value) => updateWorld('genre', value)} placeholder="奇幻/科幻/末世/日常..." />
                </Field>
              )}
              b={(
                <Field label="基调">
                  <TextInput value={form.world.tone} onChange={(value) => updateWorld('tone', value)} placeholder="轻松/黑暗/史诗/荒诞..." />
                </Field>
              )}
            />
          </Block>

          <Block title="▸ 时间">
            <TwoCol
              a={(
                <Field label="时代">
                  <TextInput value={form.world.era} onChange={(value) => updateWorld('era', value)} placeholder="中世纪 / 近未来 2200" />
                </Field>
              )}
              b={(
                <Field label="初始时段">
                  <Select
                    value={form.world.time}
                    onChange={(value) => updateWorld('time', value)}
                    options={TIME_OPTIONS}
                  />
                </Field>
              )}
            />
            <TwoCol
              a={(
                <Field label="季节">
                  <TextInput value={form.world.season} onChange={(value) => updateWorld('season', value)} placeholder="春季" />
                </Field>
              )}
              b={(
                <Field label="历法/纪元">
                  <TextInput value={form.world.calendar} onChange={(value) => updateWorld('calendar', value)} placeholder="大陆历 1374 年" />
                </Field>
              )}
            />
          </Block>

          <Block title="▸ 地理">
            <Field label="初始地点">
              <TextInput
                value={form.world.current_location}
                onChange={(value) => updateWorld('current_location', value)}
                placeholder="应填写下方地点之一"
              />
            </Field>
            <Field label="地点">
              <ObjListEditor
                rows={form.world.locations}
                fields={[{ k: 'name', ph: '地点名' }, { k: 'desc', ph: '描述' }]}
                onChange={(rows) => updateWorld('locations', rows)}
                addLabel="添加地点"
              />
            </Field>
          </Block>

          <Block title="▸ 自然">
            <TwoCol
              a={(
                <Field label="初始天气">
                  <TextInput value={form.world.weather} onChange={(value) => updateWorld('weather', value)} placeholder="晴朗" />
                </Field>
              )}
              b={(
                <Field label="气候">
                  <TextInput value={form.world.climate} onChange={(value) => updateWorld('climate', value)} placeholder="温带,多雾" />
                </Field>
              )}
            />
          </Block>

          <Block title="▸ 社会">
            <Field label="主要种族">
              <TextInput
                value={form.world.races}
                onChange={(value) => updateWorld('races', value)}
                placeholder="人类,精灵,矮人(逗号分隔)"
              />
            </Field>
            <Field label="势力">
              <ObjListEditor
                rows={form.world.factions}
                fields={[{ k: 'name', ph: '势力名' }, { k: 'desc', ph: '描述' }, { k: 'attitude', ph: '态度' }]}
                onChange={(rows) => updateWorld('factions', rows)}
                addLabel="添加势力"
              />
            </Field>
            <TwoCol
              a={(
                <Field label="律法/禁忌">
                  <TextInput value={form.world.laws} onChange={(value) => updateWorld('laws', value)} />
                </Field>
              )}
              b={(
                <Field label="文化习俗">
                  <TextInput value={form.world.culture} onChange={(value) => updateWorld('culture', value)} />
                </Field>
              )}
            />
          </Block>

          <Block title="▸ 规则">
            <TwoCol
              a={(
                <Field label="魔法/超能力体系">
                  <TextInput value={form.world.magic_system} onChange={(value) => updateWorld('magic_system', value)} />
                </Field>
              )}
              b={(
                <Field label="经济体系">
                  <TextInput value={form.world.economy} onChange={(value) => updateWorld('economy', value)} />
                </Field>
              )}
            />
          </Block>

          <Block title="▸ 叙事">
            <Field label={<>世界历史背景 <span className="req">*</span></>}>
              <TextArea value={form.world.history} onChange={(value) => updateWorld('history', value)} rows={3} />
            </Field>
            <Field label="核心冲突">
              <TextInput value={form.world.central_conflict} onChange={(value) => updateWorld('central_conflict', value)} />
            </Field>
            <Field label="剧情线索">
              <TextInput
                value={form.world.plot_hooks}
                onChange={(value) => updateWorld('plot_hooks', value)}
                placeholder="线索1;线索2(分号分隔)"
              />
            </Field>
            <Field label="开局事件">
              <TextInput
                value={form.world.initial_events}
                onChange={(value) => updateWorld('initial_events', value)}
                placeholder="事件1;事件2(分号分隔)"
              />
            </Field>
          </Block>
        </FormSection>

        <FormSection
          num="③"
          title="角色(NPC)"
          right={(
            <>
              <span className="sec-count" id="char-count">{form.characters.length} 个</span>
              <button
                type="button"
                className="btn tiny"
                id="btn-add-char"
                onClick={(e) => { e.stopPropagation(); addChar(); }}
              >
                ＋ 添加角色
              </button>
            </>
          )}
        >
          {form.characters.map((char, index) => (
            <CharacterEditor
              key={`character-${index}`}
              char={char}
              isPlayer={false}
              onChange={(path, value) => updateChar(index, path, value)}
              onDelete={() => removeChar(index)}
              confirmDialog={confirmDialog}
            />
          ))}
        </FormSection>

        <FormSection
          num="④"
          title="我的角色(扮演)"
          right={<span className="sec-badge">⚠️ 智能体只能看到你的公开信息</span>}
        >
          <CharacterEditor
            char={form.player}
            isPlayer
            onChange={updatePlayer}
            onDelete={() => {}}
            confirmDialog={confirmDialog}
          />
        </FormSection>
      </main>

      <div className="create-footer">
        <ErrorBar id="create-errors-foot" errors={errors} />
        <button
          type="button"
          id="btn-submit-create"
          className="btn primary big"
          disabled={submitting}
          onClick={submit}
        >
          {submitting ? '创建中...' : '🏰 创建并进入'}
        </button>
      </div>
    </section>
  );
}