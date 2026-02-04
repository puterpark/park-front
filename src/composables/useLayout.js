import { computed, reactive } from 'vue';
import { useLayoutStore } from '@/stores/useLayoutStore';

const layoutConfig = reactive({
  preset: 'Aura',
  primary: 'blue',
  surface: null,
  menuMode: 'static',
});

const layoutState = reactive({
  staticMenuInactive: false,
  overlayMenuActive: false,
  profileSidebarVisible: false,
  configSidebarVisible: false,
  sidebarExpanded: false,
  menuHoverActive: false,
  activeMenuItem: null,
  activePath: null,
});

export function useLayout() {
  const layoutStore = useLayoutStore();

  const toggleDarkMode = () => {
    if (!document.startViewTransition) {
      layoutStore.toggleDarkMode();
      return;
    }
    document.startViewTransition(() => layoutStore.toggleDarkMode());
  };

  const toggleMenu = () => {
    if (isDesktop()) {
      if (layoutConfig.menuMode === 'static') {
        layoutState.staticMenuInactive = !layoutState.staticMenuInactive;
      }

      if (layoutConfig.menuMode === 'overlay') {
        layoutState.overlayMenuActive = !layoutState.overlayMenuActive;
      }
    } else {
      layoutState.mobileMenuActive = !layoutState.mobileMenuActive;
    }
  };

  const toggleConfigSidebar = () => {
    layoutState.configSidebarVisible = !layoutState.configSidebarVisible;
  };

  const hideMobileMenu = () => {
    layoutState.mobileMenuActive = false;
  };

  const changeMenuMode = (event) => {
    layoutConfig.menuMode = event.value;
    layoutState.staticMenuInactive = false;
    layoutState.mobileMenuActive = false;
    layoutState.sidebarExpanded = false;
    layoutState.menuHoverActive = false;
    layoutState.anchored = false;
  };

  const isDarkTheme = computed(() => layoutStore.isDarkTheme);
  const isDesktop = () => window.innerWidth > 991;

  const hasOpenOverlay = computed(() => layoutState.overlayMenuActive);

  return {
    layoutConfig,
    layoutState,
    isDarkTheme,
    toggleDarkMode,
    toggleConfigSidebar,
    toggleMenu,
    hideMobileMenu,
    changeMenuMode,
    isDesktop,
    hasOpenOverlay,
  };
}
