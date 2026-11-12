(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const dateInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const dateFromInput = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  };
  const shiftDate = (date, amount) => {
    const shifted = new Date(date);
    shifted.setDate(shifted.getDate() + amount);
    return shifted;
  };
  const dateLabel = (value, options = { weekday: "long", month: "long", day: "numeric" }) =>
    new Intl.DateTimeFormat(undefined, options).format(dateFromInput(value));
  const escapeText = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  const elements = {
    currentDate: $("#current-date"),
    selectedTitle: $("#selected-day-title"),
    selectedSummary: $("#selected-day-summary"),
    dayTabs: $("#day-tabs"),
    selectedTasks: $("#selected-day-tasks"),
    overdueTasks: $("#overdue-tasks"),
    completedTasks: $("#completed-tasks"),
    laterTasks: $("#later-tasks"),
    overdueCount: $("#overdue-count"),
    completedCount: $("#completed-count"),
    form: $("#task-form"),
    formHeading: $("#form-heading"),
    status: $("#status"),
    weekRange: $("#week-range"),
    weekDays: $("#week-days"),
    previousWeek: $("#previous-week"),
    nextWeek: $("#next-week")
  };

  const now = new Date();
  let today = dateInput(now);
  let selectedDate = today;
  let weekOffset = 0;
  let editingId = null;
  let deletedItem = null;

  // One task record drives each view; storage can be added without changing rendering.
  const tasks = [
    { id: crypto.randomUUID(), title: "Review class notes", type: "assignment", date: dateInput(shiftDate(now, -1)), start: "4:00 PM", end: "", complete: false },
    { id: crypto.randomUUID(), title: "Plan the week", type: "task", date: today, start: "", end: "", complete: false },
    { id: crypto.randomUUID(), title: "Study for upcoming quiz", type: "assignment", date: dateInput(shiftDate(now, 1)), start: "5:00 PM", end: "", complete: false },
    { id: crypto.randomUUID(), title: "Team meeting", type: "event", date: dateInput(shiftDate(now, 2)), start: "2:30 PM", end: "4:00 PM", complete: false },
    { id: crypto.randomUUID(), title: "Prepare project outline", type: "assignment", date: dateInput(shiftDate(now, 5)), start: "", end: "", complete: false },
    { id: crypto.randomUUID(), title: "Reply to study group", type: "task", date: today, start: "", end: "", complete: true }
  ];

  const setStatus = (message, undo = false) => {
    elements.status.replaceChildren(document.createTextNode(message));
    if (undo) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "undo-action";
      button.textContent = "Undo";
      button.addEventListener("click", restoreDeleted);
      elements.status.append(button);
    }
  };

  const timeText = (task) => task.start ? `${task.start}${task.end ? ` – ${task.end}` : ""}` : "";
  const taskMarkup = (task) => {
    const type = task.type[0].toUpperCase() + task.type.slice(1);
    const due = task.date ? dateLabel(task.date, { weekday: "short", month: "short", day: "numeric" }) : "No date";
    const schedule = [due, timeText(task)].filter(Boolean).join(" · ");
    const completed = task.complete ? "Completed · " : "";
    return `<article class="task" data-task-id="${task.id}">
      <input class="task-check" type="checkbox" ${task.complete ? "checked" : ""} aria-label="Mark ${escapeText(task.title)} ${task.complete ? "incomplete" : "complete"}">
      <span><span class="task-title ${task.complete ? "done" : ""}">${escapeText(task.title)}</span><span class="meta">${completed}${type} · ${schedule}</span></span>
      <span class="task-actions"><button type="button" class="text-action edit-action">Edit</button><button type="button" class="text-action delete-action">Delete</button></span>
    </article>`;
  };

  const renderList = (container, items, emptyText) => {
    container.innerHTML = items.length ? items.map(taskMarkup).join("") : `<p class="empty">${emptyText}</p>`;
  };

  const renderTabs = () => {
    const choices = [0, 1, 2].map((offset) => {
      const date = dateInput(shiftDate(dateFromInput(today), offset));
      return { date, label: offset === 0 ? `Today · ${dateLabel(date, { weekday: "short", month: "short", day: "numeric" })}` : dateLabel(date, { weekday: "short", month: "short", day: "numeric" }) };
    });
    elements.dayTabs.innerHTML = choices.map(({ date, label }) =>
      `<button type="button" role="tab" class="day-tab" aria-selected="${selectedDate === date}" data-date="${date}">${escapeText(label)}</button>`
    ).join("");
    const selected = choices.find((choice) => choice.date === selectedDate) || choices[0];
    selectedDate = selected.date;
    elements.selectedTitle.textContent = selectedDate === today ? `Today · ${dateLabel(today)}` : dateLabel(selectedDate);
    elements.selectedSummary.textContent = selectedDate === today ? "Tasks and events scheduled for today." : `Tasks and events scheduled for ${dateLabel(selectedDate)}.`;
    elements.selectedTasks.setAttribute("aria-label", `Tasks due ${dateLabel(selectedDate)}`);
    renderList(elements.selectedTasks, tasks.filter((task) => !task.complete && (task.date || today) === selectedDate), "Nothing scheduled for this day.");
  };

  const renderWeek = () => {
    const current = dateFromInput(today);
    const sunday = shiftDate(current, -current.getDay() + weekOffset * 7);
    const saturday = shiftDate(sunday, 6);
    elements.weekRange.textContent = `${dateLabel(dateInput(sunday), { weekday: "long", month: "short", day: "numeric" })} – ${dateLabel(dateInput(saturday), { weekday: "long", month: "short", day: "numeric", year: "numeric" })}`;
    elements.weekDays.replaceChildren();

    for (let index = 0; index < 7; index += 1) {
      const date = dateInput(shiftDate(sunday, index));
      const day = document.createElement("article");
      day.className = `week-day${date === today ? " today" : ""}`;
      const name = document.createElement("span");
      name.className = "day-name";
      name.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(dateFromInput(date)) + (date === today ? " · Today" : "");
      const dateNode = document.createElement("span");
      dateNode.className = "day-date";
      dateNode.textContent = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(dateFromInput(date));
      day.append(name, dateNode);

      const dueTasks = tasks.filter((task) => !task.complete && task.date === date);
      if (!dueTasks.length) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "No tasks";
        day.append(empty);
      } else {
        dueTasks.forEach((task) => {
          const label = document.createElement("div");
          label.className = "week-task";
          label.textContent = task.title + (timeText(task) ? ` · ${timeText(task)}` : "");
          day.append(label);
        });
      }
      elements.weekDays.append(day);
    }
    elements.previousWeek.disabled = weekOffset <= 0;
  };

  const render = () => {
    const nowDate = new Date();
    const newToday = dateInput(nowDate);
    if (newToday !== today) { today = newToday; selectedDate = today; weekOffset = 0; }
    elements.currentDate.dateTime = today;
    elements.currentDate.textContent = dateLabel(today);
    const overdue = tasks.filter((task) => !task.complete && task.date && task.date < today);
    const complete = tasks.filter((task) => task.complete);
    const later = tasks.filter((task) => !task.complete && task.date && task.date > dateInput(shiftDate(dateFromInput(today), 2)));
    elements.overdueCount.textContent = overdue.length;
    elements.completedCount.textContent = complete.length;
    renderList(elements.overdueTasks, overdue, "No overdue tasks.");
    renderList(elements.completedTasks, complete, "No completed tasks yet.");
    renderList(elements.laterTasks, later, "No later tasks.");
    renderTabs();
    renderWeek();
  };

  const putTaskInForm = (task) => {
    const form = elements.form;
    form.elements.title.value = task?.title || "";
    form.elements.type.value = task?.type || "task";
    form.elements.date.value = task?.date || "";
    const setTime = (point, value) => {
      const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(value || "");
      form.elements[`${point}Hour`].value = match?.[1] || "";
      form.elements[`${point}Minute`].value = match?.[2] || "00";
      form.elements[`${point}Period`].value = match?.[3] || "AM";
    };
    setTime("start", task?.start);
    setTime("end", task?.end);
    editingId = task?.id || null;
    elements.formHeading.textContent = editingId ? "Edit item" : "Add item";
    form.hidden = false;
    form.elements.title.focus();
  };

  const readTime = (form, point) => {
    const hour = form.elements[`${point}Hour`].value;
    return hour ? `${hour}:${form.elements[`${point}Minute`].value} ${form.elements[`${point}Period`].value}` : "";
  };

  const parseMinutes = (time) => {
    const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(time);
    if (!match) return null;
    return (Number(match[1]) % 12 + (match[3] === "PM" ? 12 : 0)) * 60 + Number(match[2]);
  };

  elements.dayTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-date]");
    if (!tab) return;
    selectedDate = tab.dataset.date;
    render();
  });

  document.addEventListener("click", (event) => {
    const row = event.target.closest("[data-task-id]");
    if (!row) return;
    const task = tasks.find((item) => item.id === row.dataset.taskId);
    if (!task) return;

    if (event.target.matches(".edit-action")) putTaskInForm(task);
    if (event.target.matches(".delete-action")) {
      deletedItem = { task, index: tasks.indexOf(task) };
      tasks.splice(deletedItem.index, 1);
      setStatus(`“${task.title}” deleted.`, true);
      render();
    }
  });

  document.addEventListener("change", (event) => {
    if (!event.target.matches(".task-check")) return;
    const task = tasks.find((item) => item.id === event.target.closest("[data-task-id]")?.dataset.taskId);
    if (!task) return;
    task.complete = event.target.checked;
    setStatus(task.complete ? `“${task.title}” moved to Completed.` : `“${task.title}” restored to its date.`);
    render();
  });

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = elements.form;
    const start = readTime(form, "start");
    const end = readTime(form, "end");
    if (end && !start) { form.elements.startHour.focus(); setStatus("Choose a start time before setting an end time."); return; }
    if (start && end && parseMinutes(end) <= parseMinutes(start)) { form.elements.endHour.focus(); setStatus("End time must be later than the start time."); return; }
    const values = { title: form.elements.title.value.trim(), type: form.elements.type.value, date: form.elements.date.value, start, end };
    if (!values.title) return;
    if (editingId) {
      const task = tasks.find((item) => item.id === editingId);
      Object.assign(task, values);
      setStatus(`Saved changes to “${task.title}”.`);
    } else {
      tasks.push({ id: crypto.randomUUID(), ...values, complete: false });
      setStatus(`“${values.title}” added.`);
    }
    selectedDate = values.date || today;
    elements.form.reset();
    elements.form.hidden = true;
    editingId = null;
    render();
  });

  function restoreDeleted() {
    if (!deletedItem) return;
    tasks.splice(deletedItem.index, 0, deletedItem.task);
    setStatus("Task restored.");
    deletedItem = null;
    render();
  }

  $("#add-task").addEventListener("click", () => putTaskInForm(null));
  $("#cancel-edit").addEventListener("click", () => { elements.form.reset(); elements.form.hidden = true; editingId = null; });
  elements.previousWeek.addEventListener("click", () => { if (weekOffset > 0) { weekOffset -= 1; renderWeek(); } });
  elements.nextWeek.addEventListener("click", () => { weekOffset += 1; renderWeek(); });

  document.querySelectorAll('select[name$="Hour"]').forEach((select) => {
    for (let hour = 1; hour <= 12; hour += 1) {
      const option = document.createElement("option");
      option.value = String(hour);
      option.textContent = String(hour);
      select.append(option);
    }
  });

  render();
  // Keep the displayed day current if the page stays open across midnight or wakes from sleep.
  window.setInterval(render, 60_000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
})();
