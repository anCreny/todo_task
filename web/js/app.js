import { api, clearSession, hasToken, saveSession } from "./api.js";

const page = document.body.dataset.page;
const THEME_STORAGE_KEY = "todo_task.theme";
const THEMES = new Set(["light", "dark"]);
const NULL_TYPE_NAME = "null";
const DEFAULT_TYPE_COLOR = "#16a34a";
const FALLBACK_TYPE_COLOR = "#f8fafc";

const handlers = {
  index: initIndex,
  login: initLogin,
  register: initRegister,
  home: initHome,
  settings: initSettings,
  board: initBoard,
  task: initTask,
  overview: initOverview,
};

let homeState = { boards: [], types: [], userLogin: "" };
let boardState = {
  board: null,
  columns: [],
  tasks: [],
  types: [],
  editMode: false,
  selectedTaskID: "",
  selectedColumnID: "",
};
let taskState = { board: null, columns: [], task: null, types: [] };
let overviewState = { board: null, columns: [], tasks: [], types: [] };

applyTheme(getInitialTheme());

document.addEventListener("DOMContentLoaded", () => {
  bindThemeToggle();
  bindLogout();
  const handler = handlers[page];
  if (handler) {
    handler().catch(handleFatal);
  }
});

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function getAlert() {
  return $("[data-alert]");
}

function notify(message, type = "error") {
  const alert = getAlert();
  if (!alert) {
    return;
  }
  alert.textContent = message;
  alert.className = `alert ${type} is-visible`;
}

function clearAlert() {
  const alert = getAlert();
  if (!alert) {
    return;
  }
  alert.textContent = "";
  alert.className = "alert";
}

function normalizeTheme(theme) {
  return THEMES.has(theme) ? theme : "light";
}

function getInitialTheme() {
  try {
    return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "light";
  }
}

function applyTheme(theme) {
  const nextTheme = normalizeTheme(theme);
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;
  updateThemeButtons();
}

function saveTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, normalizeTheme(theme));
  } catch {
    // Theme switching still works for the current page if storage is blocked.
  }
}

function toggleTheme() {
  const currentTheme = normalizeTheme(document.documentElement.dataset.theme);
  const nextTheme = currentTheme === "light" ? "dark" : "light";
  saveTheme(nextTheme);
  applyTheme(nextTheme);
}

function createThemeButton() {
  const button = document.createElement("button");
  button.className = "ghost-button symbol-button theme-toggle";
  button.type = "button";
  button.dataset.themeToggle = "";
  button.innerHTML = '<span aria-hidden="true"></span>';
  return button;
}

function bindThemeToggle() {
  const navs = $all(".nav");

  if (navs.length) {
    navs.forEach((nav) => {
      if (nav.querySelector("[data-theme-toggle]")) {
        return;
      }

      const button = createThemeButton();
      const logoutButton = nav.querySelector("[data-logout]");
      nav.insertBefore(button, logoutButton || null);
    });
  } else {
    const authCard = $(".auth-card");
    if (authCard && !authCard.querySelector("[data-theme-toggle]")) {
      const tools = document.createElement("div");
      tools.className = "auth-tools";
      tools.append(createThemeButton());
      authCard.prepend(tools);
    }
  }

  $all("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", toggleTheme);
  });
  updateThemeButtons();
}

function updateThemeButtons() {
  if (!document.body) {
    return;
  }

  const currentTheme = normalizeTheme(document.documentElement.dataset.theme);
  const targetTheme = currentTheme === "light" ? "dark" : "light";
  const label = targetTheme === "light" ? "Светлая тема" : "Темная тема";
  const icon = targetTheme === "light" ? "☼" : "☾";

  $all("[data-theme-toggle]").forEach((button) => {
    const iconElement = button.querySelector("[aria-hidden]");
    button.dataset.themeToggle = targetTheme;
    button.setAttribute("aria-label", label);
    button.title = label;
    if (iconElement) {
      iconElement.textContent = icon;
    }
  });
}

function handleFatal(error) {
  if (error && error.status === 401) {
    redirectToLogin();
    return;
  }
  notify(error?.message || "Не удалось выполнить действие");
}

function validateLogin(login) {
  if (!login) {
    return "Введите логин";
  }
  if (!/^[a-z0-9]+$/.test(login)) {
    return "Логин может содержать только строчные латинские буквы и цифры";
  }
  if (login.length > 10) {
    return "Логин не должен быть длиннее 10 символов";
  }
  return "";
}

function validatePassword(password, label = "Пароль") {
  if (!password) {
    return `${label} не заполнен`;
  }
  if (password.length < 8) {
    return `${label} должен быть не короче 8 символов`;
  }
  if (password.length > 30) {
    return `${label} не должен быть длиннее 30 символов`;
  }
  if (!/[a-z]/.test(password)) {
    return `${label} должен содержать хотя бы одну строчную латинскую букву`;
  }
  if (!/[A-Z]/.test(password)) {
    return `${label} должен содержать хотя бы одну заглавную латинскую букву`;
  }
  if (!/[0-9]/.test(password)) {
    return `${label} должен содержать хотя бы одну цифру`;
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return `${label} должен содержать хотя бы один специальный символ`;
  }
  return "";
}

function setBusy(form, isBusy) {
  $all("button, input, select, textarea", form).forEach((element) => {
    element.disabled = isBusy;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeTypeColor(color, fallback = DEFAULT_TYPE_COLOR) {
  const value = String(color || "").trim().toLowerCase();
  const match = /^#?([0-9a-f]{6})$/i.exec(value);
  return match ? `#${match[1].toLowerCase()}` : fallback;
}

function getPathParts() {
  return window.location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
}

function getBoardID() {
  return getPathParts()[1];
}

function getTaskID() {
  return getPathParts()[3];
}

function boardPath(boardID) {
  return `/boards/${encodeURIComponent(boardID)}`;
}

function overviewPath(boardID) {
  return `${boardPath(boardID)}/overview`;
}

function taskPath(boardID, taskID) {
  return `${boardPath(boardID)}/tasks/${encodeURIComponent(taskID)}`;
}

function redirectToLogin() {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/login?next=${encodeURIComponent(next)}`);
}

function getNextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/")) {
    return "/home";
  }
  return next;
}

async function requireAuth() {
  if (!hasToken()) {
    redirectToLogin();
    throw new Error("not authenticated");
  }

  try {
    return await api.auth.currentUser();
  } catch (error) {
    if (error.status === 401) {
      redirectToLogin();
    }
    throw error;
  }
}

function bindLogout() {
  $all("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await api.auth.logout();
      } catch {
        clearSession();
      }
      window.location.assign("/login");
    });
  });
}

function sortColumns(columns) {
  return [...columns].sort((a, b) => {
    if (a.order_number === -1 && b.order_number !== -1) {
      return -1;
    }
    if (b.order_number === -1 && a.order_number !== -1) {
      return 1;
    }
    return a.order_number - b.order_number;
  });
}

function visibleKanbanColumns(columns) {
  return sortColumns(columns).filter((column) => column.order_number !== -1);
}

function nextColumnOrder(columns) {
  const positiveOrders = columns
    .map((column) => column.order_number)
    .filter((order) => order > 0);
  return positiveOrders.length ? Math.max(...positiveOrders) + 1 : 1;
}

function findByID(collection, id) {
  return collection.find((item) => item.id === id);
}

function isNullType(type) {
  return !type || type.name === NULL_TYPE_NAME;
}

function taskTypeColor(type) {
  return sanitizeTypeColor(type?.color, FALLBACK_TYPE_COLOR);
}

function typeChip(type) {
  if (!type) {
    return `<span class="type-chip" style="--chip: ${FALLBACK_TYPE_COLOR}">unknown</span>`;
  }
  return `<span class="type-chip" style="--chip: ${escapeHtml(sanitizeTypeColor(type.color, FALLBACK_TYPE_COLOR))}">${escapeHtml(type.name)}</span>`;
}

function renderTypeOptions(types, selectedID = "") {
  return types
    .map((type) => {
      const selected = type.id === selectedID ? "selected" : "";
      return `<option value="${escapeHtml(type.id)}" ${selected}>${escapeHtml(type.name)}</option>`;
    })
    .join("");
}

function renderColumnOptions(columns, selectedID = "") {
  return sortColumns(columns)
    .map((column) => {
      const selected = column.id === selectedID ? "selected" : "";
      return `<option value="${escapeHtml(column.id)}" ${selected}>${escapeHtml(column.name)}</option>`;
    })
    .join("");
}

function formatDate(value) {
  if (!value) {
    return "нет данных";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCounter(label, value) {
  return `${label}: ${value}`;
}

function formatCounters(counters) {
  return counters.map(([label, value]) => formatCounter(label, value)).join(", ");
}

async function initIndex() {
  if (!hasToken()) {
    window.location.replace("/login");
    return;
  }

  try {
    await api.auth.currentUser();
    window.location.replace("/home");
  } catch {
    clearSession();
    window.location.replace("/login");
  }
}

async function initLogin() {
  if (hasToken()) {
    try {
      await api.auth.currentUser();
      window.location.replace("/home");
      return;
    } catch {
      clearSession();
    }
  }

  const form = $("#login-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert();
    setBusy(form, true);

    try {
      const login = form.elements.login.value.trim().toLowerCase();
      const password = form.elements.password.value;
      const loginError = validateLogin(login);
      if (loginError) {
        notify(loginError);
        setBusy(form, false);
        return;
      }
      if (!password) {
        notify("Введите пароль");
        setBusy(form, false);
        return;
      }
      const tokens = await api.auth.login(login, password);
      saveSession(tokens);
      window.location.assign(getNextPath());
    } catch (error) {
      notify(error.message || "Не удалось войти");
    } finally {
      setBusy(form, false);
    }
  });
}

async function initRegister() {
  const form = $("#register-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert();

    const login = form.elements.login.value.trim().toLowerCase();
    const password = form.elements.password.value;
    const passwordConfirm = form.elements.password_confirm.value;
    const loginError = validateLogin(login);
    const passwordError = validatePassword(password);

    if (loginError) {
      notify(loginError);
      return;
    }

    if (passwordError) {
      notify(passwordError);
      return;
    }

    if (password !== passwordConfirm) {
      notify("Пароли не совпадают");
      return;
    }

    setBusy(form, true);
    try {
      await api.auth.register(login, password);
      const tokens = await api.auth.login(login, password);
      saveSession(tokens);
      window.location.assign("/home");
    } catch (error) {
      notify(error.message || "Не удалось зарегистрироваться");
    } finally {
      setBusy(form, false);
    }
  });
}

async function initHome() {
  const user = await requireAuth();
  homeState.userLogin = user.login;
  renderHomeCaption();

  $("#board-create-form").addEventListener("submit", handleBoardCreate);
  $("#type-create-form").addEventListener("submit", handleTypeCreate);
  $("#boards-list").addEventListener("submit", handleBoardUpdate);
  $("#boards-list").addEventListener("click", handleBoardAction);
  $("#types-list").addEventListener("submit", handleTypeUpdate);
  $("#types-list").addEventListener("click", handleTypeAction);

  await loadHome();
}

async function loadHome() {
  const [boards, types] = await Promise.all([
    api.boards.list(),
    api.types.list(),
  ]);
  homeState = {
    boards: boards || [],
    types: types || [],
    userLogin: homeState.userLogin,
  };
  renderHomeCaption();
  renderBoards();
  renderTypes();
}

function renderBoards() {
  const root = $("#boards-list");
  if (!homeState.boards.length) {
    root.innerHTML = '<div class="empty-state">Досок пока нет. Создайте первую доску.</div>';
    return;
  }

  root.innerHTML = homeState.boards
    .map((board) => `
      <article class="board-row" data-board-row="${escapeHtml(board.id)}">
        <a class="board-row-link" href="${boardPath(board.id)}">
          <strong>${escapeHtml(board.name)}</strong>
        </a>
        <form class="board-row-edit hidden" data-board-update="${escapeHtml(board.id)}" data-board-name="${escapeHtml(board.name)}">
          <input class="input" name="name" maxlength="50" value="${escapeHtml(board.name)}" required>
          <button class="ghost-button symbol-button" type="submit" aria-label="Сохранить доску" title="Сохранить доску">
            <span aria-hidden="true">✓</span>
          </button>
        </form>
        <div class="board-row-actions">
          <button class="icon-button board-row-icon" type="button" data-board-edit="${escapeHtml(board.id)}" aria-label="Переименовать доску" title="Переименовать">
            <span aria-hidden="true">✎</span>
          </button>
          <button class="icon-button board-row-icon is-danger" type="button" data-board-delete="${escapeHtml(board.id)}" aria-label="Удалить доску" title="Удалить">
            <span aria-hidden="true">X</span>
          </button>
        </div>
      </article>
    `)
    .join("");
}

function renderHomeCaption() {
  const visibleTypesCount = homeState.types.filter((type) => type.name !== NULL_TYPE_NAME).length;
  $("#user-caption").textContent = [
    `пользователь: ${homeState.userLogin || "..."}`,
    formatCounter("доски", homeState.boards.length),
    formatCounter("типы", visibleTypesCount),
  ].join(", ");
}

function renderTypes() {
  const root = $("#types-list");
  const visibleTypes = homeState.types.filter((type) => type.name !== NULL_TYPE_NAME);
  if (!visibleTypes.length) {
    root.innerHTML = '<div class="empty-state">Типов пока нет.</div>';
    return;
  }

  root.innerHTML = visibleTypes
    .map((type) => `
      <article class="type-row" data-type-row="${escapeHtml(type.id)}">
        <div class="type-row-summary">
          <span class="type-row-color" style="--type-color: ${escapeHtml(sanitizeTypeColor(type.color, FALLBACK_TYPE_COLOR))}"></span>
          <strong>${escapeHtml(type.name)}</strong>
        </div>
        <form class="type-row-edit hidden" data-type-update="${escapeHtml(type.id)}">
          <input class="input" name="name" aria-label="Код типа" maxlength="10" pattern="[a-z0-9_.-]+" value="${escapeHtml(type.name)}" required>
          <input class="input type-color-input" name="color" aria-label="Цвет типа" type="color" value="${escapeHtml(sanitizeTypeColor(type.color))}" required>
          <button class="ghost-button symbol-button" type="submit" aria-label="Сохранить тип" title="Сохранить тип">
            <span aria-hidden="true">✓</span>
          </button>
        </form>
        <div class="type-row-actions">
          <button class="icon-button type-row-icon" type="button" data-type-edit="${escapeHtml(type.id)}" aria-label="Изменить тип" title="Изменить">
            <span aria-hidden="true">✎</span>
          </button>
          <button class="icon-button type-row-icon is-danger" type="button" data-type-delete="${escapeHtml(type.id)}" aria-label="Удалить тип" title="Удалить">
            <span aria-hidden="true">X</span>
          </button>
        </div>
      </article>
    `)
    .join("");
}

async function handleBoardCreate(event) {
  event.preventDefault();
  clearAlert();
  const form = event.currentTarget;
  setBusy(form, true);
  try {
    await api.boards.create(form.elements.name.value.trim());
    form.reset();
    await loadHome();
    notify("Доска создана", "success");
  } catch (error) {
    notify(error.message || "Не удалось создать доску");
  } finally {
    setBusy(form, false);
  }
}

async function handleBoardUpdate(event) {
  const form = event.target.closest("[data-board-update]");
  if (!form) {
    return;
  }

  event.preventDefault();
  clearAlert();
  setBusy(form, true);
  try {
    await api.boards.update(form.dataset.boardUpdate, {
      name: form.elements.name.value.trim(),
    });
    await loadHome();
    notify("Доска обновлена", "success");
  } catch (error) {
    notify(error.message || "Не удалось обновить доску");
  } finally {
    setBusy(form, false);
  }
}

async function handleBoardAction(event) {
  const editButton = event.target.closest("[data-board-edit]");
  if (editButton) {
    const row = editButton.closest("[data-board-row]");
    const form = row.querySelector("[data-board-update]");
    row.classList.add("is-editing");
    row.querySelector(".board-row-link").classList.add("hidden");
    form.classList.remove("hidden");
    form.elements.name.focus();
    form.elements.name.select();
    return;
  }

  const deleteButton = event.target.closest("[data-board-delete]");
  if (!deleteButton) {
    return;
  }

  const boardID = deleteButton.dataset.boardDelete;
  if (!window.confirm("Удалить доску вместе с колонками и задачами?")) {
    return;
  }

  clearAlert();
  deleteButton.disabled = true;
  try {
    await api.boards.delete(boardID);
    await loadHome();
    notify("Доска удалена", "success");
  } catch (error) {
    notify(error.message || "Не удалось удалить доску");
  }
}

async function handleTypeCreate(event) {
  event.preventDefault();
  clearAlert();
  const form = event.currentTarget;
  setBusy(form, true);
  try {
    await api.types.create(
      form.elements.name.value.trim().toLowerCase(),
      sanitizeTypeColor(form.elements.color.value),
    );
    form.reset();
    form.elements.color.value = DEFAULT_TYPE_COLOR;
    await loadHome();
    notify("Тип создан", "success");
  } catch (error) {
    notify(error.message || "Не удалось создать тип");
  } finally {
    setBusy(form, false);
  }
}

async function handleTypeUpdate(event) {
  const form = event.target.closest("[data-type-update]");
  if (!form) {
    return;
  }

  event.preventDefault();
  clearAlert();
  setBusy(form, true);
  try {
    await api.types.update(form.dataset.typeUpdate, {
      name: form.elements.name.value.trim().toLowerCase(),
      color: sanitizeTypeColor(form.elements.color.value),
    });
    await loadHome();
    notify("Тип обновлен", "success");
  } catch (error) {
    notify(error.message || "Не удалось обновить тип");
  } finally {
    setBusy(form, false);
  }
}

async function handleTypeAction(event) {
  const editButton = event.target.closest("[data-type-edit]");
  if (editButton) {
    const row = editButton.closest("[data-type-row]");
    const form = row.querySelector("[data-type-update]");
    row.classList.add("is-editing");
    row.querySelector(".type-row-summary").classList.add("hidden");
    form.classList.remove("hidden");
    form.elements.name.focus();
    form.elements.name.select();
    return;
  }

  const deleteButton = event.target.closest("[data-type-delete]");
  if (!deleteButton) {
    return;
  }

  if (!window.confirm("Удалить тип? Задачи с этим типом могут перестать обновляться.")) {
    return;
  }

  clearAlert();
  deleteButton.disabled = true;
  try {
    await api.types.delete(deleteButton.dataset.typeDelete);
    await loadHome();
    notify("Тип удален", "success");
  } catch (error) {
    notify(error.message || "Не удалось удалить тип");
  }
}

async function initSettings() {
  const user = await requireAuth();
  $("#settings-caption").textContent = `Пользователь: ${user.login}`;

  const form = $("#password-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert();

    const oldPassword = form.elements.old_password.value;
    const newPassword = form.elements.new_password.value;
    const newPasswordError = validatePassword(newPassword, "Новый пароль");

    if (!oldPassword) {
      notify("Текущий пароль не заполнен");
      return;
    }

    if (newPasswordError) {
      notify(newPasswordError);
      return;
    }

    if (oldPassword === newPassword) {
      notify("Новый пароль должен отличаться от текущего");
      return;
    }

    setBusy(form, true);
    try {
      await api.auth.changePassword(oldPassword, newPassword);
      form.reset();
      notify("Пароль изменен", "success");
    } catch (error) {
      notify(error.message || "Не удалось изменить пароль");
    } finally {
      setBusy(form, false);
    }
  });
}

async function initBoard() {
  await requireAuth();

  const boardID = getBoardID();
  $("#board-kanban-switch").href = boardPath(boardID);
  $("#board-overview-switch").href = overviewPath(boardID);

  $("#board-edit-toggle").addEventListener("click", toggleBoardEditMode);
  $("#column-create-toggle").addEventListener("click", openColumnCreateModal);
  $("#kanban").addEventListener("click", handleKanbanClick);
  $("#task-modal-form").addEventListener("submit", handleTaskModalSubmit);
  $("#task-modal-delete").addEventListener("click", handleTaskModalDelete);
  $("#column-modal-form").addEventListener("submit", handleColumnModalSubmit);
  $("#column-modal-delete").addEventListener("click", handleColumnModalDelete);
  $all("[data-modal-close]").forEach((button) => {
    button.addEventListener("click", closeBoardModals);
  });
  $all(".modal-backdrop").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) {
        closeBoardModals();
      }
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeBoardModals();
    }
  });

  await loadBoard(boardID);
}

async function loadBoard(boardID) {
  const editMode = boardState.editMode;
  const [board, columns, types] = await Promise.all([
    api.boards.get(boardID),
    api.columns.list(boardID),
    api.types.list(),
  ]);

  const tasks = columns?.length ? await api.tasks.list(boardID) : [];
  boardState = {
    board,
    columns: columns || [],
    tasks: tasks || [],
    types: types || [],
    editMode,
    selectedTaskID: boardState.selectedTaskID,
    selectedColumnID: boardState.selectedColumnID,
  };
  renderBoard();
}

function renderBoard() {
  const board = boardState.board;
  const columns = visibleKanbanColumns(boardState.columns);
  const columnIDs = new Set(columns.map((column) => column.id));
  const tasks = boardState.tasks.filter((task) => columnIDs.has(task.column_id));

  $("#board-title").textContent = board.name;
  $("#board-caption").textContent = formatCounters([
    ["колонки", columns.length],
    ["задачи", tasks.length],
  ]);
  renderBoardModeButton();

  const root = $("#kanban");
  root.style.setProperty("--kanban-column-count", String(Math.max(columns.length, 1)));
  root.classList.toggle("is-editing", boardState.editMode);
  root.classList.toggle("is-empty", !columns.length);

  if (!columns.length) {
    root.innerHTML = '<div class="empty-state">На доске нет отображаемых колонок.</div>';
    return;
  }

  root.innerHTML = columns
    .map((column) => {
      const tasks = boardState.tasks.filter((task) => task.column_id === column.id);
      return `
        <article class="kanban-column">
          <header class="kanban-column-header">
            <div class="kanban-column-title">
              <h2 title="${escapeHtml(column.name)}">${escapeHtml(column.name)}</h2>
              ${
                boardState.editMode
                  ? `<button class="icon-button column-edit-button" type="button" data-column-open-edit="${escapeHtml(column.id)}" aria-label="Редактировать колонку ${escapeHtml(column.name)}" title="Редактировать колонку">
                      <span aria-hidden="true">✎</span>
                    </button>`
                  : ""
              }
            </div>
          </header>
          <div class="kanban-task-list">
            ${tasks.length ? tasks.map(renderTaskCard).join("") : ""}
            ${
              boardState.editMode
                ? renderTaskAddCard(column)
                : tasks.length
                  ? ""
                  : '<div class="kanban-empty">Задач нет</div>'
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTaskAddCard(column) {
  return `
    <button class="task-card kanban-task-card kanban-add-card" type="button" data-task-open-create="${escapeHtml(column.id)}" aria-label="Создать задачу в колонке ${escapeHtml(column.name)}" title="Создать задачу">
      <span class="kanban-add-plus" aria-hidden="true">+</span>
    </button>
  `;
}

function renderTaskCard(task) {
  const type = findByID(boardState.types, task.type_id);
  return `
    <button class="task-card kanban-task-card" type="button" data-task-open="${escapeHtml(task.id)}">
      <span class="task-color-label" style="--task-color: ${escapeHtml(taskTypeColor(type))}"></span>
      <strong class="task-card-title">${escapeHtml(task.label)}</strong>
    </button>
  `;
}

function renderBoardModeButton() {
  const button = $("#board-edit-toggle");
  const columnCreateButton = $("#column-create-toggle");
  const title = boardState.editMode ? "Выключить редактирование" : "Включить редактирование";
  button.setAttribute("aria-pressed", String(boardState.editMode));
  button.setAttribute("aria-label", title);
  button.title = title;
  button.classList.toggle("is-active", boardState.editMode);
  columnCreateButton.classList.toggle("hidden", !boardState.editMode);
}

function toggleBoardEditMode() {
  boardState.editMode = !boardState.editMode;
  if (!boardState.editMode) {
    closeBoardModals();
  }
  renderBoard();
}

function openModal(modal) {
  document.body.dataset.modalScrollX = String(window.scrollX);
  document.body.dataset.modalScrollY = String(window.scrollY);
  modal.classList.remove("hidden");
  document.body.classList.add("is-modal-open");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

function closeBoardModals() {
  const scrollX = Number(document.body.dataset.modalScrollX || 0);
  const scrollY = Number(document.body.dataset.modalScrollY || 0);
  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }
  closeModal($("#task-modal"));
  closeModal($("#column-modal"));
  document.body.classList.remove("is-modal-open");
  boardState.selectedTaskID = "";
  boardState.selectedColumnID = "";
  $("#task-modal-form").removeAttribute("data-mode");
  $("#column-modal-form").removeAttribute("data-mode");
  delete document.body.dataset.modalScrollX;
  delete document.body.dataset.modalScrollY;
  requestAnimationFrame(() => {
    window.scrollTo(scrollX, scrollY);
  });
}

function setTaskModalEditable() {
  const form = $("#task-modal-form");
  $all("input, select, textarea", form).forEach((element) => {
    element.disabled = false;
  });
  $("#task-modal-submit").classList.remove("hidden");
  const cancelButton = $("#task-modal-cancel");
  cancelButton.textContent = "←";
  cancelButton.setAttribute("aria-label", "Отмена");
  cancelButton.title = "Отмена";
}

function fillTaskModalOptions(selectedColumnID = "", selectedTypeID = "") {
  const form = $("#task-modal-form");
  const columns = visibleKanbanColumns(boardState.columns);
  const typeOptions = [
    '<option value="">Тип по умолчанию</option>',
    renderTypeOptions(boardState.types, selectedTypeID),
  ].join("");

  form.elements.type_id.innerHTML = typeOptions;
  form.elements.column_id.innerHTML = renderColumnOptions(columns, selectedColumnID);
}

function openTaskCreateModal(columnID) {
  const column = findByID(boardState.columns, columnID);
  if (!column) {
    return;
  }

  const form = $("#task-modal-form");

  boardState.selectedColumnID = columnID;
  boardState.selectedTaskID = "";
  form.dataset.mode = "create";
  form.dataset.columnId = columnID;
  form.removeAttribute("data-task-id");
  form.reset();
  fillTaskModalOptions(columnID);
  $("#task-modal-title").textContent = "Новая задача";
  $("#task-modal-subtitle").textContent = column.name;
  $("#task-modal-submit").textContent = "✓";
  $("#task-modal-submit").setAttribute("aria-label", "Создать задачу");
  $("#task-modal-submit").title = "Создать задачу";
  setTaskModalEditable();
  $("#task-modal-delete").classList.add("hidden");
  openModal($("#task-modal"));
  form.elements.label.focus();
}

function openTaskModal(taskID) {
  const task = findByID(boardState.tasks, taskID);
  if (!task) {
    return;
  }

  const form = $("#task-modal-form");
  const column = findByID(boardState.columns, task.column_id);

  boardState.selectedTaskID = taskID;
  boardState.selectedColumnID = task.column_id;
  form.dataset.mode = "edit";
  form.dataset.taskId = taskID;
  form.dataset.columnId = task.column_id;
  form.elements.label.value = task.label || "";
  form.elements.description.value = task.description || "";
  fillTaskModalOptions(task.column_id, task.type_id);
  $("#task-modal-title").textContent = "Редактирование задачи";
  $("#task-modal-subtitle").textContent = column?.name || "Без колонки";
  $("#task-modal-submit").textContent = "✓";
  $("#task-modal-submit").setAttribute("aria-label", "Сохранить задачу");
  $("#task-modal-submit").title = "Сохранить задачу";
  setTaskModalEditable();
  $("#task-modal-delete").classList.add("hidden");
  openModal($("#task-modal"));
  form.elements.label.focus();
  form.elements.label.select();
}

function openColumnCreateModal() {
  const form = $("#column-modal-form");
  const orderNumber = nextColumnOrder(boardState.columns);

  boardState.selectedColumnID = "";
  form.dataset.mode = "create";
  form.removeAttribute("data-column-id");
  form.reset();
  form.elements.order_number.value = String(orderNumber);
  $("#column-modal-title").textContent = "Новая колонка";
  $("#column-modal-subtitle").textContent = "Колонки отображаются слева направо по порядку.";
  $("#column-modal-submit").textContent = "✓";
  $("#column-modal-submit").setAttribute("aria-label", "Создать колонку");
  $("#column-modal-submit").title = "Создать колонку";
  $("#column-modal-delete").classList.add("hidden");
  openModal($("#column-modal"));
  form.elements.name.focus();
}

function openColumnEditModal(columnID) {
  const column = findByID(boardState.columns, columnID);
  if (!column) {
    return;
  }

  const form = $("#column-modal-form");
  boardState.selectedColumnID = columnID;
  form.dataset.mode = "edit";
  form.dataset.columnId = columnID;
  form.elements.name.value = column.name;
  form.elements.order_number.value = String(column.order_number);
  $("#column-modal-title").textContent = "Редактирование колонки";
  $("#column-modal-subtitle").textContent = "Название и порядок меняют отображение канбана.";
  $("#column-modal-submit").textContent = "✓";
  $("#column-modal-submit").setAttribute("aria-label", "Сохранить колонку");
  $("#column-modal-submit").title = "Сохранить колонку";
  $("#column-modal-delete").classList.remove("hidden");
  openModal($("#column-modal"));
  form.elements.name.focus();
  form.elements.name.select();
}

async function handleKanbanClick(event) {
  const taskButton = event.target.closest("[data-task-open]");
  if (taskButton) {
    openTaskModal(taskButton.dataset.taskOpen);
    return;
  }

  const createButton = event.target.closest("[data-task-open-create]");
  if (createButton && boardState.editMode) {
    openTaskCreateModal(createButton.dataset.taskOpenCreate);
    return;
  }

  const columnEditButton = event.target.closest("[data-column-open-edit]");
  if (columnEditButton && boardState.editMode) {
    openColumnEditModal(columnEditButton.dataset.columnOpenEdit);
  }
}

async function handleTaskModalSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const saved = form.dataset.mode === "edit"
    ? await updateTaskFromModal(form)
    : await createTaskFromModal(form);

  if (saved) {
    closeBoardModals();
  }
}

async function createTaskFromModal(form) {
  clearAlert();
  setBusy(form, true);
  try {
    await api.tasks.create(boardState.board.id, {
      label: form.elements.label.value.trim(),
      description: form.elements.description.value.trim(),
      type_id: form.elements.type_id.value,
      column_id: form.elements.column_id.value || form.dataset.columnId,
    });
    await loadBoard(boardState.board.id);
    notify("Задача создана", "success");
    return true;
  } catch (error) {
    notify(error.message || "Не удалось создать задачу");
    return false;
  } finally {
    setBusy(form, false);
  }
}

async function updateTaskFromModal(form) {
  clearAlert();
  setBusy(form, true);
  try {
    const task = findByID(boardState.tasks, form.dataset.taskId);
    const selectedColumnID = form.elements.column_id.value;

    await api.tasks.update(boardState.board.id, form.dataset.taskId, {
      label: form.elements.label.value.trim(),
      description: form.elements.description.value.trim(),
      type_id: form.elements.type_id.value || undefined,
    });

    if (selectedColumnID && task && selectedColumnID !== task.column_id) {
      await api.tasks.move(boardState.board.id, form.dataset.taskId, selectedColumnID);
    }

    await loadBoard(boardState.board.id);
    notify("Задача обновлена", "success");
    return true;
  } catch (error) {
    notify(error.message || "Не удалось обновить задачу");
    return false;
  } finally {
    setBusy(form, false);
  }
}

async function handleTaskModalDelete() {
  const taskID = $("#task-modal-form").dataset.taskId;
  if (!taskID || !window.confirm("Удалить задачу?")) {
    return;
  }

  clearAlert();
  $("#task-modal-delete").disabled = true;
  try {
    await api.tasks.delete(boardState.board.id, taskID);
    closeBoardModals();
    await loadBoard(boardState.board.id);
    notify("Задача удалена", "success");
  } catch (error) {
    notify(error.message || "Не удалось удалить задачу");
  } finally {
    $("#task-modal-delete").disabled = false;
  }
}

async function handleColumnModalSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const saved = form.dataset.mode === "edit"
    ? await updateColumnFromModal(form)
    : await createColumnFromModal(form);

  if (saved) {
    closeBoardModals();
  }
}

async function createColumnFromModal(form) {
  clearAlert();
  setBusy(form, true);
  try {
    await api.columns.create(boardState.board.id, {
      name: form.elements.name.value.trim(),
      order_number: Number(form.elements.order_number.value),
    });
    await loadBoard(boardState.board.id);
    notify("Колонка создана", "success");
    return true;
  } catch (error) {
    notify(error.message || "Не удалось создать колонку");
    return false;
  } finally {
    setBusy(form, false);
  }
}

async function updateColumnFromModal(form) {
  clearAlert();
  setBusy(form, true);
  try {
    await api.columns.update(boardState.board.id, form.dataset.columnId, {
      name: form.elements.name.value.trim(),
      order_number: Number(form.elements.order_number.value),
    });
    await loadBoard(boardState.board.id);
    notify("Колонка обновлена", "success");
    return true;
  } catch (error) {
    notify(error.message || "Не удалось обновить колонку");
    return false;
  } finally {
    setBusy(form, false);
  }
}

async function handleColumnModalDelete() {
  const columnID = $("#column-modal-form").dataset.columnId;
  if (!columnID || !window.confirm("Удалить колонку? Задачи будут перенесены в backlog, если он есть.")) {
    return;
  }

  clearAlert();
  $("#column-modal-delete").disabled = true;
  try {
    await api.columns.delete(boardState.board.id, columnID);
    closeBoardModals();
    await loadBoard(boardState.board.id);
    notify("Колонка удалена", "success");
  } catch (error) {
    notify(error.message || "Не удалось удалить колонку");
  } finally {
    $("#column-modal-delete").disabled = false;
  }
}

async function initTask() {
  await requireAuth();

  const boardID = getBoardID();
  const taskID = getTaskID();
  $("#board-link").href = boardPath(boardID);
  $("#task-overview-link").href = overviewPath(boardID);
  $("#task-form").addEventListener("submit", handleTaskSave);
  $("#task-delete").addEventListener("click", handleTaskDelete);

  await loadTaskDetail(boardID, taskID);
}

async function loadTaskDetail(boardID, taskID) {
  const [board, columns, types, task] = await Promise.all([
    api.boards.get(boardID),
    api.columns.list(boardID),
    api.types.list(),
    api.tasks.get(boardID, taskID),
  ]);

  taskState = {
    board,
    columns: columns || [],
    types: types || [],
    task,
  };
  renderTaskDetail();
}

function renderTaskDetail() {
  const { board, columns, task, types } = taskState;
  $("#task-title").textContent = task.label;
  $("#task-caption").textContent = `Доска: ${board.name}`;

  const typeOptions = renderTypeOptions(types, task.type_id);
  const columnOptions = renderColumnOptions(columns, task.column_id);

  $("#task-form").innerHTML = `
    <label class="field">
      <span>Название</span>
      <input class="input" name="label" maxlength="50" value="${escapeHtml(task.label)}" required>
    </label>
    <label class="field">
      <span>Описание</span>
      <textarea class="textarea" name="description" maxlength="300">${escapeHtml(task.description)}</textarea>
    </label>
    <label class="field">
      <span>Тип</span>
      <select class="select" name="type_id" ${types.length ? "" : "disabled"}>${typeOptions}</select>
    </label>
    <label class="field">
      <span>Колонка</span>
      <select class="select" name="column_id" ${columns.length ? "" : "disabled"}>${columnOptions}</select>
    </label>
    <button class="button symbol-button" type="submit" aria-label="Сохранить задачу" title="Сохранить задачу">
      <span aria-hidden="true">✓</span>
    </button>
  `;

  const type = findByID(types, task.type_id);
  const column = findByID(columns, task.column_id);
  $("#task-meta").innerHTML = `
    <div>${typeChip(type)}</div>
    <div><span class="label">Колонка</span><br>${escapeHtml(column?.name || "unknown")}</div>
    <div><span class="label">Создана</span><br>${escapeHtml(formatDate(task.created_at))}</div>
    <div><span class="label">Обновлена</span><br>${escapeHtml(formatDate(task.updated_at))}</div>
  `;
}

async function handleTaskSave(event) {
  event.preventDefault();
  clearAlert();

  const form = event.currentTarget;
  const { board, task } = taskState;
  const selectedTypeID = form.elements.type_id?.value;
  const selectedColumnID = form.elements.column_id?.value;

  setBusy(form, true);
  try {
    await api.tasks.update(board.id, task.id, {
      label: form.elements.label.value.trim(),
      description: form.elements.description.value.trim(),
      type_id: selectedTypeID || undefined,
    });

    if (selectedColumnID && selectedColumnID !== task.column_id) {
      await api.tasks.move(board.id, task.id, selectedColumnID);
    }

    await loadTaskDetail(board.id, task.id);
    notify("Задача обновлена", "success");
  } catch (error) {
    notify(error.message || "Не удалось обновить задачу");
  } finally {
    setBusy(form, false);
  }
}

async function handleTaskDelete() {
  if (!window.confirm("Удалить задачу?")) {
    return;
  }

  const { board, task } = taskState;
  clearAlert();
  $("#task-delete").disabled = true;
  try {
    await api.tasks.delete(board.id, task.id);
    window.location.assign(boardPath(board.id));
  } catch (error) {
    $("#task-delete").disabled = false;
    notify(error.message || "Не удалось удалить задачу");
  }
}

async function initOverview() {
  await requireAuth();

  const boardID = getBoardID();
  $("#overview-kanban-switch").href = boardPath(boardID);
  $("#overview-overview-switch").href = overviewPath(boardID);
  $("#group-by").addEventListener("change", renderOverview);
  await loadOverview(boardID);
}

async function loadOverview(boardID) {
  const [board, columns, types] = await Promise.all([
    api.boards.get(boardID),
    api.columns.list(boardID),
    api.types.list(),
  ]);
  const tasks = columns?.length ? await api.tasks.list(boardID) : [];

  overviewState = {
    board,
    columns: columns || [],
    types: types || [],
    tasks: tasks || [],
  };
  renderOverview();
}

function renderOverview() {
  const { board, columns, tasks, types } = overviewState;
  $("#overview-title").textContent = board.name;
  $("#overview-caption").textContent = formatCounters([["задачи", tasks.length]]);

  const mode = $("#group-by").value;
  const root = $("#overview-list");
  const groupSeed = mode === "column" ? sortColumns(columns) : types;
  const groups = new Map();

  groupSeed.forEach((item) => {
    groups.set(item.id, {
      item,
      tasks: [],
    });
  });

  tasks.forEach((task) => {
    const key = mode === "column" ? task.column_id : task.type_id;
    if (!groups.has(key)) {
      groups.set(key, {
        item: null,
        tasks: [],
      });
    }
    groups.get(key).tasks.push(task);
  });

  if (!groups.size) {
    root.innerHTML = '<div class="empty-state">Задач пока нет.</div>';
    return;
  }

  root.innerHTML = [...groups.values()]
    .map((group) => renderOverviewGroup(group, mode))
    .join("");
}

function renderOverviewGroup(group, mode) {
  const { columns, types, board } = overviewState;
  const title = group.item?.name || "unknown";
  const heading = mode === "type"
    ? isNullType(group.item)
      ? "Без типа"
      : typeChip(group.item)
    : escapeHtml(title);

  return `
    <section class="overview-group">
      <h2>${heading}</h2>
      ${
        group.tasks.length
          ? group.tasks.map((task) => {
            const type = findByID(types, task.type_id);
            const column = findByID(columns, task.column_id);
            return `
              <a class="overview-row" href="${taskPath(board.id, task.id)}">
                <strong>${escapeHtml(task.label)}</strong>
                <span>${isNullType(type) ? "" : typeChip(type)}</span>
                <span class="muted">${escapeHtml(column?.name || "unknown")}</span>
              </a>
            `;
          }).join("")
          : '<div class="empty-state">В этой группе задач нет</div>'
      }
    </section>
  `;
}
