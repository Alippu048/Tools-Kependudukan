const sidebarHiddenStorageKey = 'dkb-sidebar-hidden';
const sidebarToggleButtons = document.querySelectorAll('[data-sidebar-toggle]');

sidebarToggleButtons.forEach((button) => {
    const layout = button.closest('.app-layout, .app');
    if (!layout) return;

    const hidden = localStorage.getItem(sidebarHiddenStorageKey) === 'true';
    layout.classList.toggle('sidebar-hidden', hidden);

    const label = hidden ? 'Tampilkan sidebar' : 'Sembunyikan sidebar';
    button.setAttribute('aria-expanded', String(!hidden));
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = hidden
        ? '<i class="ti ti-layout-sidebar-left-expand" aria-hidden="true"></i>'
        : '<i class="ti ti-layout-sidebar-left-collapse" aria-hidden="true"></i>';

    button.addEventListener('click', () => {
        const hidden = layout.classList.toggle('sidebar-hidden');
        localStorage.setItem(sidebarHiddenStorageKey, String(hidden));
        const label = hidden ? 'Tampilkan sidebar' : 'Sembunyikan sidebar';
        button.setAttribute('aria-expanded', String(!hidden));
        button.setAttribute('aria-label', label);
        button.title = label;
        button.innerHTML = hidden
            ? '<i class="ti ti-layout-sidebar-left-expand" aria-hidden="true"></i>'
            : '<i class="ti ti-layout-sidebar-left-collapse" aria-hidden="true"></i>';
    });
});