import { useMemo, useState } from "react";
import {
  getSkillsForProfile,
  routeValeraCommand,
  type SkillMatch,
  type ValeraAccess,
  type ValeraProfile,
} from "./skills";
import {
  readValeraLaunchContext,
  updateValeraProfileInUrl,
} from "./bridge";
import "./ValeraPage.css";

type Props = {
  userName?: string | null;
  roleCode?: string | null;
  access: ValeraAccess;
};

function getInitialProfile(): ValeraProfile {
  const launch = readValeraLaunchContext();
  if (launch.profile) return launch.profile;

  const saved = window.localStorage.getItem("valera-profile");
  return saved === "home" ? "home" : "work";
}

export default function ValeraPage({ userName, roleCode, access }: Props) {
  const launch = useMemo(() => readValeraLaunchContext(), []);
  const [profile, setProfile] = useState<ValeraProfile>(getInitialProfile);
  const [command, setCommand] = useState("");
  const [match, setMatch] = useState<SkillMatch | null>(null);
  const [checkedCommand, setCheckedCommand] = useState("");

  const skills = useMemo(
    () => getSkillsForProfile(profile, access),
    [profile, access]
  );

  function changeProfile(nextProfile: ValeraProfile) {
    setProfile(nextProfile);
    setCommand("");
    setMatch(null);
    setCheckedCommand("");
    window.localStorage.setItem("valera-profile", nextProfile);
    updateValeraProfileInUrl(nextProfile);
  }

  function testRoute(value = command) {
    const clean = value.trim();
    setCheckedCommand(clean);
    setMatch(routeValeraCommand(clean, profile, access));
  }

  function useExample(value: string) {
    setCommand(value);
    testRoute(value);
  }

  return (
    <div className="valera-page">
      <section className="valera-hero">
        <div className="valera-hero__glow valera-hero__glow--one" />
        <div className="valera-hero__glow valera-hero__glow--two" />

        <div className="valera-hero__top">
          <div>
            <div className="valera-kicker">ВАЛЕРА • PWA CORE</div>
            <h1>Помощник внутри ERP</h1>
            <p>
              APK остаётся «ушами», а навыки, интерфейс и логика живут здесь и
              обновляются через GitHub.
            </p>
          </div>

          <div className="valera-launch-badge">
            <span className="valera-launch-badge__dot" />
            {launch.source === "android" ? "Запуск из Android" : "Запуск из PWA"}
          </div>
        </div>

        <div className="valera-orb-wrap" aria-hidden="true">
          <div className="valera-orb-ring valera-orb-ring--outer" />
          <div className="valera-orb-ring valera-orb-ring--inner" />
          <div className="valera-orb">
            <div className="valera-orb__shine" />
          </div>
        </div>

        <div className="valera-status">
          <strong>
            {userName ? userName + ", ядро Валеры готово." : "Ядро Валеры готово."}
          </strong>
          <span>
            Голосовой канал подключим следующим этапом. Сейчас можно проверить
            профили и маршрутизацию команд.
          </span>
        </div>

        <div className="valera-profile-switch" role="tablist" aria-label="Профиль Валеры">
          <button
            type="button"
            className={profile === "work" ? "is-active" : ""}
            onClick={() => changeProfile("work")}
          >
            Работа
          </button>
          <button
            type="button"
            className={profile === "home" ? "is-active" : ""}
            onClick={() => changeProfile("home")}
          >
            Дом
          </button>
        </div>
      </section>

      <div className="valera-grid">
        <section className="valera-panel valera-panel--router">
          <div className="valera-panel__heading">
            <div>
              <div className="valera-eyebrow">МАРШРУТИЗАТОР</div>
              <h2>Проверка команды</h2>
            </div>
            <span className="valera-chip">
              {profile === "work" ? "Рабочий профиль" : "Домашний профиль"}
            </span>
          </div>

          <p className="valera-muted">
            Это пока безопасная проверка: команда определяется и направляется в
            нужный навык, но никаких действий в ERP не выполняет.
          </p>

          <div className="valera-command-row">
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") testRoute();
              }}
              placeholder={
                profile === "work"
                  ? "Например: закончи раскрой 21 штуки"
                  : "Например: выключи свет в кухне"
              }
            />
            <button type="button" onClick={() => testRoute()}>
              Проверить
            </button>
          </div>

          {checkedCommand && (
            <div className={match ? "valera-route-result" : "valera-route-result is-empty"}>
              {match ? (
                <>
                  <div className="valera-route-result__icon">{match.skill.icon}</div>
                  <div>
                    <strong>Навык: {match.skill.title}</strong>
                    <span>
                      {match.skill.requiresConfirmation
                        ? "Перед изменяющим действием потребуется подтверждение."
                        : "Команда относится к чтению или безопасному действию."}
                    </span>
                  </div>
                </>
              ) : (
                <div>
                  <strong>Навык не определён</strong>
                  <span>
                    Добавим новые ключевые фразы или отдельный навык, если такая
                    команда нужна регулярно.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="valera-examples">
            {(skills[0]?.examples || []).slice(0, 3).map((example) => (
              <button
                type="button"
                key={example}
                onClick={() => useExample(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </section>

        <aside className="valera-panel valera-panel--context">
          <div className="valera-eyebrow">КОНТЕКСТ</div>
          <h2>{profile === "work" ? "На работе" : "Дома"}</h2>

          <div className="valera-context-list">
            <div>
              <span>Профиль</span>
              <strong>{profile === "work" ? "Работа" : "Дом"}</strong>
            </div>
            <div>
              <span>Роль ERP</span>
              <strong>{roleCode || "employee"}</strong>
            </div>
            <div>
              <span>Источник</span>
              <strong>{launch.source === "android" ? "Android APK" : "PWA"}</strong>
            </div>
            <div>
              <span>Голос</span>
              <strong className="is-next">следующий этап</strong>
            </div>
          </div>
        </aside>
      </div>

      <section className="valera-panel">
        <div className="valera-panel__heading">
          <div>
            <div className="valera-eyebrow">НАВЫКИ</div>
            <h2>
              {profile === "work" ? "Рабочие навыки" : "Домашние навыки"}
            </h2>
          </div>
          <span className="valera-chip">{skills.length} доступно</span>
        </div>

        <div className="valera-skills">
          {skills.map((skill) => (
            <article className="valera-skill" key={skill.id}>
              <div className="valera-skill__icon">{skill.icon}</div>
              <div className="valera-skill__body">
                <div className="valera-skill__title">
                  <strong>{skill.title}</strong>
                  <span>
                    {profile === "work" ? "маршрут готов" : "запланирован"}
                  </span>
                </div>
                <p>{skill.description}</p>
                <div className="valera-skill__examples">
                  {skill.examples.slice(0, 2).map((example) => (
                    <button
                      type="button"
                      key={example}
                      onClick={() => useExample(example)}
                    >
                      «{example}»
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
