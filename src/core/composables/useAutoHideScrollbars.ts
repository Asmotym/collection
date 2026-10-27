import { onBeforeUnmount, onMounted } from 'vue';

/** Capture nested and teleported scrollers, including Vuetify menus and dialogs. */
export function useAutoHideScrollbars() {
    const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

    function reveal(element: HTMLElement) {
        clearTimeout(timers.get(element));
        element.classList.add('is-scrolling');
        timers.set(element, setTimeout(() => {
            element.classList.remove('is-scrolling');
            timers.delete(element);
        }, 1000));
    }

    function onScroll(event: Event) {
        const target = event.target === document ? document.scrollingElement : event.target;
        if (target instanceof HTMLElement) reveal(target);
    }

    function onTouch(event: TouchEvent) {
        // Reveal the nearest scroll container rather than every ancestor.
        let element = event.target instanceof Element ? event.target : null;
        while (element) {
            if (element instanceof HTMLElement) {
                const style = getComputedStyle(element);
                if ((element.scrollHeight > element.clientHeight && /auto|scroll/.test(style.overflowY))
                    || (element.scrollWidth > element.clientWidth && /auto|scroll/.test(style.overflowX))) {
                    reveal(element);
                    return;
                }
            }
            element = element.parentElement;
        }
    }

    onMounted(() => {
        document.addEventListener('scroll', onScroll, { capture: true, passive: true });
        document.addEventListener('touchstart', onTouch, { capture: true, passive: true });
        document.addEventListener('touchend', onTouch, { capture: true, passive: true });
    });
    onBeforeUnmount(() => {
        document.removeEventListener('scroll', onScroll, true);
        document.removeEventListener('touchstart', onTouch, true);
        document.removeEventListener('touchend', onTouch, true);
        timers.forEach((timer, element) => {
            clearTimeout(timer);
            element.classList.remove('is-scrolling');
        });
        timers.clear();
    });
}
