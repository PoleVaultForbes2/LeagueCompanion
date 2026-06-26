// Renders the authenticated multi-page dashboard from backend-provided game state.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buyShardWithCs,
  craftItem,
  getChampionRoster,
  getCraftingState,
  getLoadoutState,
  getRegionProgress,
  getShardInventory,
  getUserProfile,
  setActiveChampion as saveActiveChampion,
  setBackpackItem as saveBackpackItem,
  syncRecentMatches,
  upgradeItem,
} from "../services/userApi";
import RecentGamesView from "./RecentGamesView";

const PAGES = [
  { key: "MISSIONS", label: "Missions" },
  { key: "ROSTER", label: "Champions" },
  { key: "MAP_HOME", label: "Map" },
  { key: "INVENTORY", label: "Inventory" },
  { key: "CRAFTING", label: "Crafting" },
];

const CHAMPION_NAME_OVERRIDES = {
  aurelion_sol: "Aurelion Sol",
  belveth: "Bel'Veth",
  camile: "Camille",
  chogath: "Cho'Gath",
  jarvan: "Jarvan IV",
  kaisa: "Kai'Sa",
  khazix: "Kha'Zix",
  kogmaw: "Kog'Maw",
  ksante: "K'Sante",
  leesin: "Lee Sin",
  masteryi: "Master Yi",
  mf: "Miss Fortune",
  mundo: "Dr. Mundo",
  nunu: "Nunu & Willump",
  reksai: "Rek'Sai",
  renataglasc: "Renata Glasc",
  "tahm kench": "Tahm Kench",
  tf: "Twisted Fate",
  velkoz: "Vel'Koz",
  xinzhao: "Xin Zhao",
};

const CHAMPION_SPRITE_FILES = [
  "aatrox",
  "ahri",
  "akali",
  "akshan",
  "alistar",
  "ambessa",
  "amumu",
  "anivia",
  "annie",
  "aphelios",
  "ashe",
  "aurelion_sol",
  "aurora",
  "azir",
  "bard",
  "belveth",
  "blitzcrank",
  "brand",
  "braum",
  "briar",
  "caitlyn",
  "camile",
  "cassiopeia",
  "chogath",
  "corki",
  "darius",
  "diana",
  "draven",
  "ekko",
  "elise",
  "evelynn",
  "ezreal",
  "fiddlesticks",
  "fiora",
  "fizz",
  "galio",
  "gangplank",
  "garen",
  "gnar",
  "gragas",
  "graves",
  "gwen",
  "hecarim",
  "heimerdinger",
  "hwei",
  "illaoi",
  "irelia",
  "ivern",
  "janna",
  "jarvan",
  "jax",
  "jayce",
  "jhin",
  "jinx",
  "kaisa",
  "kalista",
  "karma",
  "karthus",
  "kassadin",
  "katarina",
  "kayle",
  "kayn",
  "kennen",
  "khazix",
  "kindred",
  "kled",
  "kogmaw",
  "ksante",
  "leblanc",
  "leesin",
  "leona",
  "lillia",
  "lissandra",
  "locke",
  "lucian",
  "lulu",
  "lux",
  "malphite",
  "malzahar",
  "maokai",
  "masteryi",
  "mel",
  "mf",
  "milio",
  "mordekaiser",
  "morgana",
  "mundo",
  "naafiri",
  "nami",
  "nasus",
  "nautilus",
  "neeko",
  "nidalee",
  "nilah",
  "nocturne",
  "nunu",
  "olaf",
  "orianna",
  "ornn",
  "pantheon",
  "poppy",
  "pyke",
  "qiyana",
  "quinn",
  "rakan",
  "rammus",
  "reksai",
  "rell",
  "renataglasc",
  "renekton",
  "rengar",
  "riven",
  "rumble",
  "ryze",
  "samira",
  "sejuani",
  "senna",
  "seraphine",
  "sett",
  "shaco",
  "shen",
  "shyvana",
  "singed",
  "sion",
  "sivir",
  "skarner",
  "smolder",
  "sona",
  "soraka",
  "swain",
  "sylas",
  "syndra",
  "tahm kench",
  "taliyah",
  "talon",
  "taric",
  "teemo",
  "tf",
  "thresh",
  "tristana",
  "trundle",
  "tryndamere",
  "twitch",
  "udyr",
  "urgot",
  "varus",
  "vayne",
  "veigar",
  "velkoz",
  "vex",
  "vi",
  "viego",
  "viktor",
  "vladimir",
  "volibear",
  "warwick",
  "wukong",
  "xayah",
  "xerath",
  "xinzhao",
  "yasuo",
  "yone",
  "yorick",
  "yunara",
  "yuumi",
  "zaahen",
  "zac",
  "zed",
  "zeri",
  "ziggs",
  "zilean",
  "zoe",
  "zyra",
];

const CHAMPION_ROSTER = CHAMPION_SPRITE_FILES.map((fileName) => ({
  name: getChampionDisplayName(fileName),
  assetPath: `/assets/champs/${fileName}.png`,
  isUnlocked: false,
}));

const emptyInventory = {
  shards: [],
  totalShards: 0,
  shop: {
    costPerShard: 10,
  },
};

const emptyCrafting = {
  items: [],
  shards: [],
  totalShards: 0,
};

const emptyLoadout = {
  activeChampion: null,
  backpack: Array.from({ length: 6 }, (_value, index) => ({
    slotIndex: index,
    item: null,
  })),
  backpackSize: 6,
  ownedItemCount: 0,
};

const emptyRegionProgress = {
  regions: [],
  totalPoints: 0,
};

const ITEM_CATEGORY_ORDER = [
  "ad_shard",
  "crit_shard",
  "as_shard",
  "ap_shard",
  "mana_shard",
  "health_shard",
  "armor_shard",
  "mr_shard",
  "movement_shard",
  "common_shard",
];

function getChampionDisplayName(fileName) {
  if (CHAMPION_NAME_OVERRIDES[fileName]) {
    return CHAMPION_NAME_OVERRIDES[fileName];
  }

  return fileName
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function compareByName(a, b) {
  return String(a.name || "").localeCompare(String(b.name || ""));
}

function sortChampionsForDisplay(champions) {
  return [...champions].sort((a, b) => {
    if (a.isUnlocked !== b.isUnlocked) {
      return a.isUnlocked ? -1 : 1;
    }

    return compareByName(a, b);
  });
}

function getItemCategoryIndex(item) {
  const categoryKey = item.category?.key || "";
  const index = ITEM_CATEGORY_ORDER.indexOf(categoryKey);
  return index === -1 ? ITEM_CATEGORY_ORDER.length : index;
}

function sortItemsForDisplay(items, sortMode) {
  return [...items].sort((a, b) => {
    if (a.isOwned !== b.isOwned) {
      return a.isOwned ? -1 : 1;
    }

    if (sortMode === "category") {
      const categoryDelta = getItemCategoryIndex(a) - getItemCategoryIndex(b);

      if (categoryDelta !== 0) {
        return categoryDelta;
      }
    }

    return compareByName(a, b);
  });
}

function filterItemsBySearch(items, searchTerm) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return items;
  }

  return items.filter((item) =>
    `${item.name} ${item.category?.label || ""} ${item.category?.displayName || ""}`
      .toLowerCase()
      .includes(normalizedSearch),
  );
}

function filterChampionsBySearch(champions, searchTerm) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return champions;
  }

  return champions.filter((champion) =>
    `${champion.name || ""} ${champion.role || ""} ${champion.region || ""}`
      .toLowerCase()
      .includes(normalizedSearch),
  );
}

export default function HomeView({ user, onLogout, onUserUpdated }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [inventory, setInventory] = useState(emptyInventory);
  const [crafting, setCrafting] = useState(emptyCrafting);
  const [championRoster, setChampionRoster] = useState(CHAMPION_ROSTER);
  const [loadout, setLoadout] = useState(emptyLoadout);
  const [regionProgress, setRegionProgress] = useState(emptyRegionProgress);
  const [isInventoryLoading, setIsInventoryLoading] = useState(true);
  const [isCraftingLoading, setIsCraftingLoading] = useState(true);
  const [isRosterLoading, setIsRosterLoading] = useState(true);
  const [isLoadoutLoading, setIsLoadoutLoading] = useState(true);
  const [isRegionProgressLoading, setIsRegionProgressLoading] = useState(true);
  const [isCrafting, setIsCrafting] = useState(false);
  const [isBuyingShard, setIsBuyingShard] = useState(false);
  const [isSavingLoadout, setIsSavingLoadout] = useState(false);
  const [isXpPopoverOpen, setIsXpPopoverOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncError, setSyncError] = useState("");
  const [rewardClaim, setRewardClaim] = useState(null);
  const [rewardStage, setRewardStage] = useState(1);
  const [currentPageIndex, setCurrentPageIndex] = useState(2);
  const [inventoryTab, setInventoryTab] = useState("shards");
  const [isRecentGamesOpen, setIsRecentGamesOpen] = useState(false);
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [selectedChampion, setSelectedChampion] = useState(null);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);
  const [pendingBackpackItem, setPendingBackpackItem] = useState(null);
  const [itemSortMode, setItemSortMode] = useState("category");
  const [championSearch, setChampionSearch] = useState("");
  const [craftingSearch, setCraftingSearch] = useState("");
  const [selectedCraftItemName, setSelectedCraftItemName] = useState("");
  const [selectedShardKeys, setSelectedShardKeys] = useState([]);
  const autoSyncedUserIdRef = useRef(null);
  const displayName = `${user.summonerName}#${user.tagline}`;
  const appXp = Number(user.appXp) || 0;
  const xpToNextLevel = user.xpToNextLevel || 250;
  const xpProgress = Math.min(100, Math.round((appXp / xpToNextLevel) * 100));
  const csCurrency = Number(user.csCurrency) || 0;
  const currentPage = PAGES[currentPageIndex];
  const selectedCraftItem = useMemo(
    () =>
      crafting.items.find((item) => item.name === selectedCraftItemName) ||
      crafting.items[0] ||
      null,
    [crafting.items, selectedCraftItemName],
  );
  const sortedChampionRoster = useMemo(
    () => sortChampionsForDisplay(championRoster),
    [championRoster],
  );
  const filteredChampionRoster = useMemo(
    () => filterChampionsBySearch(sortedChampionRoster, championSearch),
    [championSearch, sortedChampionRoster],
  );
  const sortedCraftingItems = useMemo(
    () => sortItemsForDisplay(crafting.items, itemSortMode),
    [crafting.items, itemSortMode],
  );
  const filteredCraftingItems = useMemo(
    () => filterItemsBySearch(sortedCraftingItems, craftingSearch),
    [craftingSearch, sortedCraftingItems],
  );

  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const [
        profilePayload,
        inventoryPayload,
        craftingPayload,
        championPayload,
        loadoutPayload,
        regionProgressPayload,
      ] = await Promise.all([
        getUserProfile(user.id),
        getShardInventory(user.id),
        getCraftingState(user.id),
        getChampionRoster(user.id),
        getLoadoutState(user.id),
        getRegionProgress(user.id),
      ]);

      onUserUpdated(profilePayload.user);
      setInventory(inventoryPayload);
      setCrafting(craftingPayload);
      setChampionRoster(championPayload.champions || CHAMPION_ROSTER);
      setLoadout(loadoutPayload || emptyLoadout);
      setRegionProgress(regionProgressPayload || emptyRegionProgress);
      setSelectedCraftItemName((current) =>
        current || craftingPayload.items?.[0]?.name || "",
      );
      setSyncError("");
    } catch (requestError) {
      setSyncError(requestError.message);
    } finally {
      setIsInventoryLoading(false);
      setIsCraftingLoading(false);
      setIsRosterLoading(false);
      setIsLoadoutLoading(false);
      setIsRegionProgressLoading(false);
      setIsRefreshing(false);
    }
  }, [onUserUpdated, user.id]);

  const runMatchSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncStatus("Checking for matches...");
    setSyncError("");

    try {
      const payload = await syncRecentMatches(user.id);

      if (payload.rewardClaim && payload.newMatchesAdded > 0) {
        setRewardClaim(payload.rewardClaim);
        setRewardStage(1);
        setSyncStatus("");
      } else {
        if (payload.user) {
          onUserUpdated(payload.user);
        }

        await refreshDashboard();
        setSyncStatus("No new matches found.");
      }
    } catch (requestError) {
      setSyncError(requestError.message);
      setSyncStatus("");
    } finally {
      setIsSyncing(false);
    }
  }, [onUserUpdated, refreshDashboard, user.id]);

  async function handleRewardDone() {
    setRewardClaim(null);
    setRewardStage(1);
    setSyncStatus("Rewards claimed.");
    await refreshDashboard();
  }

  function goToPage(nextIndex) {
    setCurrentPageIndex(Math.min(Math.max(nextIndex, 0), PAGES.length - 1));
    setIsRecentGamesOpen(false);
  }

  function toggleCraftShard(shardKey) {
    setSelectedShardKeys((current) =>
      current.includes(shardKey)
        ? current.filter((key) => key !== shardKey)
        : [...current, shardKey],
    );
  }

  async function handleCraftSelectedItem() {
    if (!selectedCraftItem || isCrafting) {
      return;
    }

    setIsCrafting(true);
    setSyncStatus("");
    setSyncError("");

    try {
      const payload = await craftItem(
        user.id,
        selectedCraftItem.name,
        selectedShardKeys,
      );
      setCrafting(payload.crafting);
      setInventory((current) => ({
        shards: payload.crafting.shards,
        totalShards: payload.crafting.totalShards,
        shop: current.shop || emptyInventory.shop,
      }));
      setSelectedShardKeys([]);
      setLoadout(await getLoadoutState(user.id));
      setSyncStatus(`${selectedCraftItem.name} crafted.`);
    } catch (requestError) {
      setSyncError(requestError.message);
    } finally {
      setIsCrafting(false);
    }
  }

  async function handleUpgradeSelectedItem() {
    if (!selectedCraftItem || isCrafting) {
      return;
    }

    setIsCrafting(true);
    setSyncStatus("");
    setSyncError("");

    try {
      const payload = await upgradeItem(
        user.id,
        selectedCraftItem.name,
        selectedShardKeys,
      );
      setCrafting(payload.crafting);
      setInventory((current) => ({
        shards: payload.crafting.shards,
        totalShards: payload.crafting.totalShards,
        shop: current.shop || emptyInventory.shop,
      }));
      setSelectedShardKeys([]);
      setLoadout(await getLoadoutState(user.id));
      setSyncStatus(`${selectedCraftItem.name} upgraded.`);
    } catch (requestError) {
      setSyncError(requestError.message);
    } finally {
      setIsCrafting(false);
    }
  }

  async function handleSetActiveChampion(champion) {
    if (!champion?.isUnlocked || isSavingLoadout) {
      return;
    }

    setIsSavingLoadout(true);
    setSyncStatus("");
    setSyncError("");

    try {
      const payload = await saveActiveChampion(user.id, champion.slug);
      setLoadout(payload.loadout || emptyLoadout);
      setSelectedChampion(null);
      setSyncStatus(`${champion.name} is now active.`);
    } catch (requestError) {
      setSyncError(requestError.message);
    } finally {
      setIsSavingLoadout(false);
    }
  }

  async function handleBuyShard(shard, quantity = 1) {
    if (!shard?.key || isBuyingShard) {
      return;
    }

    setIsBuyingShard(true);
    setSyncStatus("");
    setSyncError("");

    try {
      const purchaseQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
      const payload = await buyShardWithCs(user.id, shard.key, purchaseQuantity);
      setInventory({
        shards: payload.shards || [],
        totalShards: payload.totalShards || 0,
        shop: payload.shop || emptyInventory.shop,
      });
      setCrafting(await getCraftingState(user.id));
      onUserUpdated({
        ...user,
        csCurrency: payload.csCurrency,
      });
      setSyncStatus(`${purchaseQuantity} ${shard.category} shard purchased.`);
    } catch (requestError) {
      setSyncError(requestError.message);
    } finally {
      setIsBuyingShard(false);
    }
  }

  async function handleSetBackpackItem(item, slotIndex) {
    if (!item?.isOwned || isSavingLoadout) {
      return;
    }

    setIsSavingLoadout(true);
    setSyncStatus("");
    setSyncError("");

    try {
      const payload = await saveBackpackItem(user.id, item.name, slotIndex);
      setLoadout(payload.loadout || emptyLoadout);
      setPendingBackpackItem(null);
      setSelectedInventoryItem(null);
      setSyncStatus(`${item.name} added to backpack.`);
    } catch (requestError) {
      const replacementPayload = requestError.payload?.loadout;

      if (requestError.status === 409 && replacementPayload) {
        setLoadout(replacementPayload);
        setPendingBackpackItem(replacementPayload.pendingItem || item);
      } else {
        setSyncError(requestError.message);
      }
    } finally {
      setIsSavingLoadout(false);
    }
  }

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    if (filteredCraftingItems.length === 0) {
      return;
    }

    if (
      !selectedCraftItemName ||
      !filteredCraftingItems.some((item) => item.name === selectedCraftItemName)
    ) {
      setSelectedCraftItemName(filteredCraftingItems[0].name);
    }
  }, [filteredCraftingItems, selectedCraftItemName]);

  useEffect(() => {
    if (autoSyncedUserIdRef.current === user.id) {
      return;
    }

    autoSyncedUserIdRef.current = user.id;
    void runMatchSync();
  }, [runMatchSync, user.id]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#05070d] text-slate-100 selection:bg-amber-400/30 selection:text-amber-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950/90 shadow-2xl shadow-slate-950">
          <header className="flex min-h-20 items-center justify-between gap-3 border-b border-slate-700 bg-slate-900/90 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <img
                alt=""
                className="h-12 w-12 rounded-full border border-emerald-300/40 object-cover"
                src="/cs_logo.png"
              />
              <div className="relative min-w-0">
                <button
                  className="block max-w-[12rem] text-left sm:max-w-xs"
                  onClick={() => setIsXpPopoverOpen((current) => !current)}
                  type="button"
                >
                  <p className="truncate text-sm font-black uppercase tracking-widest text-slate-300">
                    Lv {user.appLevel} - {displayName}
                  </p>
                </button>
                <div className="mt-1 h-1.5 w-36 overflow-hidden rounded bg-slate-800">
                  <div
                    className="h-full rounded bg-emerald-300"
                    style={{ width: `${xpProgress}%` }}
                  />
                </div>
                {isXpPopoverOpen && (
                  <div className="absolute left-0 top-[2.75rem] z-30 min-w-44 rounded border border-emerald-300/30 bg-slate-950 p-3 shadow-xl shadow-slate-950">
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-200">
                      XP to Next Level
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-100">
                      {appXp} / {xpToNextLevel}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden min-w-0 text-center sm:block">
              <h1 className="truncate text-2xl font-black tracking-normal text-slate-50">
                League Companion
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-11 items-center gap-2 rounded border border-emerald-300/30 bg-emerald-500/10 px-3 text-xs font-black uppercase tracking-wide text-emerald-100">
                <span className="text-emerald-300/70">CS</span>
                <span>{csCurrency.toLocaleString()}</span>
              </div>

              <button
                className="hidden h-11 rounded bg-amber-400 px-4 text-xs font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300 disabled:cursor-wait disabled:bg-slate-600 disabled:text-slate-300 sm:block"
                disabled={isSyncing || isRefreshing}
                onClick={runMatchSync}
                type="button"
              >
                {isSyncing ? "Syncing..." : "Sync"}
              </button>

              <div className="relative">
                <button
                  aria-expanded={isMenuOpen}
                  aria-label="Open menu"
                  className="flex h-11 w-11 items-center justify-center rounded border border-slate-700 text-slate-300 transition hover:border-amber-300/60 hover:text-amber-200"
                  onClick={() => setIsMenuOpen((current) => !current)}
                  type="button"
                >
                  <span className="flex flex-col gap-1">
                    <span className="block h-0.5 w-5 rounded bg-current" />
                    <span className="block h-0.5 w-5 rounded bg-current" />
                    <span className="block h-0.5 w-5 rounded bg-current" />
                  </span>
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 top-[3.25rem] z-30 w-48 rounded border border-slate-700 bg-slate-950 p-2 shadow-xl shadow-slate-950">
                    <button
                      className="h-10 w-full rounded px-3 text-left text-sm font-bold text-slate-300 transition hover:bg-slate-800 hover:text-amber-200"
                      onClick={() => {
                        setIsRecentGamesOpen(true);
                        setIsMenuOpen(false);
                      }}
                      type="button"
                    >
                      View Recent Games
                    </button>
                    <button
                      className="h-10 w-full rounded px-3 text-left text-sm font-bold text-slate-300 transition hover:bg-slate-800 hover:text-amber-200 sm:hidden"
                      disabled={isSyncing || isRefreshing}
                      onClick={() => {
                        setIsMenuOpen(false);
                        void runMatchSync();
                      }}
                      type="button"
                    >
                      Sync Matches
                    </button>
                    <button
                      className="h-10 w-full rounded px-3 text-left text-sm font-bold text-slate-300 transition hover:bg-slate-800 hover:text-amber-200"
                      onClick={onLogout}
                      type="button"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div
            className={`flex flex-col gap-1 border-b px-4 py-3 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between sm:px-6 ${
              syncError
                ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                : "border-cyan-300/25 bg-cyan-500/10 text-cyan-100"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-widest text-slate-300">
              {isRecentGamesOpen ? "Recent Games" : currentPage.label}
            </p>
            {(syncStatus || syncError) && (
              <p className="text-sm font-semibold">{syncError || syncStatus}</p>
            )}
          </div>

          <div className="relative min-h-[calc(100vh-7rem)]">
            {!isRecentGamesOpen && (
              <>
                <PageArrow
                  direction="left"
                  disabled={currentPageIndex === 0}
                  onClick={() => goToPage(currentPageIndex - 1)}
                />
                <PageArrow
                  direction="right"
                  disabled={currentPageIndex === PAGES.length - 1}
                  onClick={() => goToPage(currentPageIndex + 1)}
                />
              </>
            )}

            {isRecentGamesOpen ? (
              <div className="px-4 py-5 sm:px-6 lg:px-20">
                <RecentGamesView
                  onBack={() => {
                    setIsRecentGamesOpen(false);
                    setCurrentPageIndex(2);
                  }}
                  user={user}
                />
              </div>
            ) : (
              <div className="overflow-hidden">
                <div
                  className="flex transition-transform duration-500 ease-out"
                  style={{ transform: `translateX(-${currentPageIndex * 100}%)` }}
                >
                  <PagePane>
                    <MissionsPage
                      isRegionProgressLoading={isRegionProgressLoading}
                      onViewRegionPoints={() => setIsRegionModalOpen(true)}
                      regionProgress={regionProgress}
                    />
                  </PagePane>
                  <PagePane>
                    <RosterPage
                      championSearch={championSearch}
                      champions={filteredChampionRoster}
                      isLoading={isRosterLoading}
                      onChampionSelected={setSelectedChampion}
                      setChampionSearch={setChampionSearch}
                    />
                  </PagePane>
                  <PagePane>
                    <MapHomePage
                      isLoadoutLoading={isLoadoutLoading}
                      loadout={loadout}
                    />
                  </PagePane>
                  <PagePane>
                    <InventoryPage
                      csCurrency={csCurrency}
                      inventory={inventory}
                      inventoryTab={inventoryTab}
                      isBuyingShard={isBuyingShard}
                      isInventoryLoading={isInventoryLoading}
                      isCraftingLoading={isCraftingLoading}
                      itemSortMode={itemSortMode}
                      items={sortedCraftingItems}
                      onBuyShard={handleBuyShard}
                      onItemSelected={setSelectedInventoryItem}
                      setInventoryTab={setInventoryTab}
                      setItemSortMode={setItemSortMode}
                    />
                  </PagePane>
                  <PagePane>
                    <CraftingPage
                      craftingSearch={craftingSearch}
                      inventory={inventory}
                      isCrafting={isCrafting}
                      isCraftingLoading={isCraftingLoading}
                      onCraft={handleCraftSelectedItem}
                      onUpgrade={handleUpgradeSelectedItem}
                      itemSortMode={itemSortMode}
                      items={filteredCraftingItems}
                      selectedItem={selectedCraftItem}
                      selectedShardKeys={selectedShardKeys}
                      setCraftingSearch={setCraftingSearch}
                      setSelectedItemName={setSelectedCraftItemName}
                      setItemSortMode={setItemSortMode}
                      toggleCraftShard={toggleCraftShard}
                    />
                  </PagePane>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <RewardModal
        claim={rewardClaim}
        isRefreshing={isRefreshing}
        onDone={handleRewardDone}
        onNext={() => setRewardStage(2)}
        stage={rewardStage}
      />
      <ChampionCardModal
        activeChampion={loadout.activeChampion}
        champion={selectedChampion}
        isSaving={isSavingLoadout}
        onClose={() => setSelectedChampion(null)}
        onSetActive={handleSetActiveChampion}
      />
      <ItemCardModal
        backpack={loadout.backpack}
        isSaving={isSavingLoadout}
        item={selectedInventoryItem}
        onBackpackSlotSelected={(slotIndex) =>
          pendingBackpackItem
            ? handleSetBackpackItem(pendingBackpackItem, slotIndex)
            : undefined
        }
        onClose={() => {
          setPendingBackpackItem(null);
          setSelectedInventoryItem(null);
        }}
        onSetActive={(item) => handleSetBackpackItem(item)}
        pendingBackpackItem={pendingBackpackItem}
      />
      <RegionPointsModal
        isLoading={isRegionProgressLoading}
        isOpen={isRegionModalOpen}
        onClose={() => setIsRegionModalOpen(false)}
        regionProgress={regionProgress}
      />
    </main>
  );
}

function PageArrow({ direction, disabled, onClick }) {
  const isLeft = direction === "left";

  return (
    <button
      aria-label={isLeft ? "Previous page" : "Next page"}
      className={`fixed top-1/2 z-20 flex h-16 w-12 -translate-y-1/2 items-center justify-center rounded border border-cyan-300/30 bg-slate-950/90 text-4xl font-black text-cyan-100 shadow-2xl shadow-cyan-950/40 transition hover:border-amber-300 hover:text-amber-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-700 sm:h-20 sm:w-14 ${
        isLeft ? "left-2 sm:left-5" : "right-2 sm:right-5"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {isLeft ? "<" : ">"}
    </button>
  );
}

function PagePane({ children }) {
  return <section className="min-w-full px-4 py-5 sm:px-6 lg:px-20">{children}</section>;
}

function PagePanel({ children, className = "" }) {
  return (
    <div
      className={`min-h-[calc(100vh-10rem)] rounded-lg border border-slate-700 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/40 sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

function MissionsPage({
  isRegionProgressLoading,
  onViewRegionPoints,
  regionProgress,
}) {
  return (
    <PagePanel className="flex items-center justify-center">
      <div className="text-center">
        <p className="text-3xl font-black tracking-normal text-slate-300">
          Missions coming soon...
        </p>
        <button
          className="mt-6 rounded border border-cyan-300/25 bg-slate-950/80 px-5 py-3 text-sm font-black uppercase tracking-wide text-cyan-100 transition hover:border-cyan-300/60 hover:bg-slate-950"
          onClick={onViewRegionPoints}
          type="button"
        >
          View Region Points
        </button>
        <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-500">
          {isRegionProgressLoading
            ? "Loading regions..."
            : `${regionProgress.totalPoints || 0} total points`}
        </p>
      </div>
    </PagePanel>
  );
}

function MapHomePage({ isLoadoutLoading, loadout }) {
  const activeChampion = loadout.activeChampion;
  const backpackSlots = loadout.backpack || emptyLoadout.backpack;

  return (
    <PagePanel className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="min-w-0">
        <h2 className="mb-4 text-3xl font-black tracking-normal text-slate-50">
          Active Champion
        </h2>
        <div className="rounded-lg border border-cyan-300/20 bg-slate-950/70 p-5 shadow-xl shadow-cyan-950/20">
          {isLoadoutLoading ? (
            <div className="flex min-h-[420px] items-center justify-center text-sm font-bold uppercase tracking-widest text-slate-500">
              Loading loadout...
            </div>
          ) : (
            <>
              <div className="rounded border border-slate-700 bg-slate-900 p-4">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded border border-cyan-300/20 bg-slate-950">
                  {activeChampion ? (
                    <img
                      alt=""
                      className="h-full w-full object-contain"
                      src={activeChampion.assetPath}
                    />
                  ) : (
                    <span className="text-sm font-black uppercase tracking-widest text-slate-600">
                      No champion
                    </span>
                  )}
                </div>
                <p className="mt-4 truncate text-2xl font-black text-slate-50">
                  {activeChampion?.name || "No Active Champion"}
                </p>
                <p className="mt-1 text-xs font-black uppercase tracking-wide text-cyan-200">
                  {activeChampion
                    ? `${activeChampion.role} - ${activeChampion.region}`
                    : "Set one from the roster"}
                </p>
              </div>

              <div className="mt-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                  Backpack
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {backpackSlots.map((slot) => (
                    <div
                      className="flex aspect-square items-center justify-center rounded border border-slate-700 bg-slate-900 p-2"
                      key={slot.slotIndex}
                    >
                      {slot.item ? (
                        <img
                          alt=""
                          className="h-full w-full object-contain"
                          src={slot.item.assetPath}
                          title={slot.item.name}
                        />
                      ) : (
                        <span className="text-xs font-black uppercase tracking-widest text-slate-700">
                          Empty
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded border border-cyan-300/20 bg-slate-950/70 p-3 shadow-inner shadow-cyan-950/30">
        <img
          alt=""
          className="max-h-[620px] w-full object-contain"
          src="/assets/world_map.png"
        />
      </div>
    </PagePanel>
  );
}

function RosterPage({
  championSearch,
  champions,
  isLoading,
  onChampionSelected,
  setChampionSearch,
}) {
  return (
    <PagePanel>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">
            Champions Roster
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-normal text-slate-50">
            Champion Vault
          </h2>
        </div>

        <label className="w-full sm:max-w-xs">
          <span className="sr-only">Search champions</span>
          <input
            className="h-11 w-full rounded border border-slate-700 bg-slate-950 px-4 text-sm font-bold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/70"
            onChange={(event) => setChampionSearch(event.target.value)}
            placeholder="Search champions..."
            type="search"
            value={championSearch}
          />
        </label>
      </div>

      {isLoading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded border border-slate-800 bg-slate-950/60 text-sm font-bold uppercase tracking-widest text-slate-500">
          Loading champions...
        </div>
      ) : champions.length === 0 ? (
        <div className="flex min-h-[320px] items-center justify-center rounded border border-slate-800 bg-slate-950/60 text-sm font-bold uppercase tracking-widest text-slate-500">
          No champions found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {champions.map((champion) => (
            <button
              className={`rounded-lg border border-slate-700 bg-slate-950/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/40 ${
                champion.isUnlocked ? "" : "grayscale contrast-75 brightness-50"
              }`}
              key={champion.slug || champion.name}
              onClick={() => onChampionSelected(champion)}
              type="button"
            >
              <div className="mb-3 flex aspect-square items-center justify-center overflow-hidden rounded border border-slate-700 bg-slate-900">
                <img
                  alt=""
                  className="h-full w-full object-contain"
                  src={champion.assetPath}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-lg font-black text-slate-100">
                  {champion.name}
                </p>
                <span className="rounded border border-slate-700 px-2 py-1 text-xs font-black uppercase tracking-wide text-slate-400">
                  {champion.isUnlocked ? "Ready" : "Locked"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-xs font-black uppercase tracking-wide text-cyan-100">
                  {champion.role || "Role"}
                </span>
                <span className="rounded border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-xs font-black uppercase tracking-wide text-amber-100">
                  {champion.region || "Region"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </PagePanel>
  );
}

function InventoryPage({
  csCurrency,
  inventory,
  inventoryTab,
  isBuyingShard,
  isCraftingLoading,
  isInventoryLoading,
  itemSortMode,
  items,
  onBuyShard,
  onItemSelected,
  setInventoryTab,
  setItemSortMode,
}) {
  const shardShop = inventory.shop || emptyInventory.shop;

  return (
    <PagePanel>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">
            Collection
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-normal text-slate-50">
            Inventory & Shards
          </h2>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="grid grid-cols-2 rounded border border-slate-700 bg-slate-950 p-1">
            {["shards", "items"].map((tab) => (
              <button
                className={`h-10 rounded px-4 text-sm font-black uppercase tracking-wide transition ${
                  inventoryTab === tab
                    ? "bg-amber-400 text-slate-950"
                    : "text-slate-400 hover:text-slate-100"
                }`}
                key={tab}
                onClick={() => setInventoryTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>

          {inventoryTab === "items" && (
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              Sort
              <select
                className="h-9 rounded border border-slate-700 bg-slate-950 px-3 text-sm font-black uppercase tracking-wide text-slate-200 outline-none transition focus:border-cyan-300"
                onChange={(event) => setItemSortMode(event.target.value)}
                value={itemSortMode}
              >
                <option value="category">Category</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
            </label>
          )}
          {inventoryTab === "shards" && (
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              {shardShop.costPerShard} CS per shard
            </p>
          )}
        </div>
      </div>

      {inventoryTab === "shards" ? (
        isInventoryLoading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded border border-slate-800 bg-slate-950/60 text-sm font-bold uppercase tracking-widest text-slate-500">
            Loading collection...
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {inventory.shards.map((shard) => (
              <ShardSlot
                costPerShard={shardShop.costPerShard}
                csCurrency={csCurrency}
                isBuyingShard={isBuyingShard}
                key={shard.key}
                onBuyShard={onBuyShard}
                shard={shard}
              />
            ))}
          </div>
        )
      ) : (
        isCraftingLoading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded border border-slate-800 bg-slate-950/60 text-sm font-bold uppercase tracking-widest text-slate-500">
            Loading items...
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <CraftedItemCard
                item={item}
                key={item.name}
                onItemSelected={onItemSelected}
              />
            ))}
          </div>
        )
      )}
    </PagePanel>
  );
}

function CraftedItemCard({ item, onItemSelected }) {
  return (
    <button
      className={`rounded-lg border border-slate-700 bg-slate-950/70 p-4 transition hover:-translate-y-0.5 hover:border-amber-300/40 ${
        item.isOwned
          ? "text-left"
          : "cursor-not-allowed text-left grayscale contrast-75 brightness-50"
      }`}
      disabled={!item.isOwned}
      onClick={() => onItemSelected(item)}
      type="button"
    >
      <div className="mb-3 flex aspect-square items-center justify-center rounded border border-slate-700 bg-slate-900 p-4">
        <img alt="" className="h-full w-full object-contain" src={item.assetPath} />
      </div>
      <p className="text-base font-black text-slate-100">{item.name}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-wide text-cyan-200">
        {item.category?.label || "Item"}
      </p>
      <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">
        {item.isOwned ? `Level ${item.level}/${item.maxLevel}` : "Empty"}
      </p>
      {item.isOwned && item.quantity > 1 && (
        <p className="mt-1 text-xs font-semibold text-slate-600">
          Copies x{item.quantity}
        </p>
      )}
      {item.isOwned && item.level < item.maxLevel && (
        <p
          className={`mt-2 text-xs font-black uppercase tracking-wide ${
            item.canUpgrade ? "text-amber-200" : "text-slate-500"
          }`}
        >
          {item.canUpgrade ? "Upgrade ready" : "Upgrade locked"}
        </p>
      )}
      {item.isOwned && item.level >= item.maxLevel && (
        <p className="mt-2 text-xs font-black uppercase tracking-wide text-emerald-200">
          Maxed
        </p>
      )}
    </button>
  );
}

function CraftingPage({
  craftingSearch,
  inventory,
  isCrafting,
  isCraftingLoading,
  itemSortMode,
  items,
  onCraft,
  onUpgrade,
  selectedItem,
  selectedShardKeys,
  setCraftingSearch,
  setSelectedItemName,
  setItemSortMode,
  toggleCraftShard,
}) {
  if (isCraftingLoading) {
    return (
      <PagePanel className="flex items-center justify-center">
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
          Loading crafting table...
        </p>
      </PagePanel>
    );
  }

  if (!selectedItem) {
    return (
      <PagePanel className="flex items-center justify-center">
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
          No craftable items available.
        </p>
      </PagePanel>
    );
  }

  const selectedAction = selectedItem.action || {
    type: "craft",
    label: "Craft",
    canUse: selectedItem.canCraft,
    recipe: selectedItem.recipe || [],
  };
  const actionRecipe = selectedAction.recipe || [];
  const actionButtonText = isCrafting
    ? selectedAction.type === "upgrade"
      ? "Upgrading..."
      : "Crafting..."
    : selectedShardKeys.length === 0 && selectedAction.type !== "maxed"
      ? "Select Shards"
    : selectedAction.label;
  const canUseSelectedAction =
    selectedAction.canUse && selectedAction.type !== "maxed";
  const canSubmitSelectedAction =
    canUseSelectedAction && selectedShardKeys.length > 0;
  const selectedShardKeySet = new Set(selectedShardKeys);

  function handleSelectedAction() {
    if (selectedAction.type === "upgrade") {
      onUpgrade();
      return;
    }

    if (selectedAction.type === "craft") {
      onCraft();
    }
  }

  return (
    <PagePanel>
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">
          Crafting Circle
        </p>
        <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-3xl font-black tracking-normal text-slate-50">
            Crafting Table
          </h2>
          <div className="grid gap-2 sm:grid-cols-[minmax(180px,260px)_auto]">
            <label className="block">
              <span className="sr-only">Search items</span>
              <input
                className="h-11 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm font-bold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300"
                onChange={(event) => setCraftingSearch(event.target.value)}
                placeholder="Search items..."
                type="search"
                value={craftingSearch}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              Sort
              <select
                className="h-11 rounded border border-slate-700 bg-slate-950 px-3 text-sm font-black uppercase tracking-wide text-slate-200 outline-none transition focus:border-cyan-300"
                onChange={(event) => setItemSortMode(event.target.value)}
                value={itemSortMode}
              >
                <option value="category">Category</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_1fr_320px]">
        <div className="rounded border border-slate-700 bg-slate-950/70 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Item
          </p>
          <div className="grid max-h-[520px] gap-2 overflow-y-auto pr-1">
            {items.length === 0 && (
              <div className="rounded border border-slate-800 bg-slate-900 px-3 py-4 text-sm font-bold text-slate-500">
                No items match your search.
              </div>
            )}
            {items.map((item) => (
              <button
                className={`flex min-h-12 items-center gap-3 rounded border px-3 py-2 text-left transition ${
                  selectedItem.name === item.name
                    ? "border-amber-300/70 bg-amber-400/10 text-amber-100"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-300/40"
                }`}
                key={item.name}
                onClick={() => setSelectedItemName(item.name)}
                type="button"
              >
                <img alt="" className="h-8 w-8 object-contain" src={item.assetPath} />
                <span className="min-w-0 break-words text-sm font-black">
                  {item.name}
                  <span className="mt-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {item.category?.label || "Item"}
                  </span>
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-2">
                  {item.isOwned && (
                    <span className="rounded border border-slate-700 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Lv {item.level}
                    </span>
                  )}
                  {item.action?.canUse && (
                    <span className="rounded bg-emerald-300 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-950">
                      {item.action.type === "upgrade" ? "Upgrade" : "Ready"}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-[520px] flex-col items-center justify-center rounded border border-slate-700 bg-[radial-gradient(circle_at_50%_42%,rgba(250,204,21,0.14),transparent_28%),linear-gradient(145deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-5">
          <div className="relative flex aspect-square w-full max-w-[360px] items-center justify-center rounded-full border border-stone-500/60 bg-stone-900 shadow-2xl shadow-slate-950">
            <div className="absolute inset-5 rounded-full border border-stone-400/20" />
            <div className="absolute inset-12 rounded-full border border-amber-300/20" />
            <div className="z-10 flex h-32 w-32 items-center justify-center rounded-full border border-amber-300/40 bg-slate-950 p-5 shadow-xl shadow-amber-950/30">
              <img
                alt=""
                className="h-full w-full object-contain"
                src={selectedItem.assetPath}
              />
            </div>
          </div>
          <p className="mt-4 text-sm font-black uppercase tracking-widest text-slate-400">
            {selectedItem.isOwned
              ? `Level ${selectedItem.level}/${selectedItem.maxLevel}`
              : "Not crafted"}
          </p>

          <button
            className="mt-6 h-12 rounded bg-amber-400 px-8 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            disabled={!canSubmitSelectedAction || isCrafting}
            onClick={handleSelectedAction}
            type="button"
          >
            {actionButtonText}
          </button>
        </div>

        <div className="grid gap-4">
          <div className="rounded border border-slate-700 bg-slate-950/70 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              Stats
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedItem.stats.map((stat) => (
                <span
                  className="rounded border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-sm font-black text-cyan-100"
                  key={stat.key}
                >
                  {stat.label}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded border border-slate-700 bg-slate-950/70 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              Needed Shards
            </p>
            <div className="grid gap-2">
              {actionRecipe.map((recipeRow) => {
                const isSelected =
                  recipeRow.shardKey === "any_shard"
                    ? selectedShardKeys.length > 0
                    : selectedShardKeySet.has(recipeRow.shardKey);
                const isCommonSelected = selectedShardKeySet.has("common_shard");

                return (
                  <div
                    className={`rounded border px-3 py-2 text-sm font-black ${
                      recipeRow.isCovered
                        ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                        : "border-rose-300/30 bg-rose-500/10 text-rose-100"
                    }`}
                    key={recipeRow.shardKey}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span>
                        {recipeRow.label}: {recipeRow.required}
                      </span>
                      <span
                        className={`rounded px-2 py-1 text-[10px] uppercase tracking-wide ${
                          isSelected
                            ? "bg-cyan-300 text-slate-950"
                            : "border border-slate-700 text-slate-500"
                        }`}
                      >
                        {isSelected ? "Selected" : "Not selected"}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs font-bold uppercase tracking-wide opacity-75">
                      Owned {recipeRow.owned}
                      {isCommonSelected && recipeRow.commonUsed > 0
                        ? ` + ${recipeRow.commonUsed} Common covering ${recipeRow.directMissing}`
                        : ""}
                      {!recipeRow.isCovered && recipeRow.shortfall > 0
                        ? ` - Short ${recipeRow.shortfall} common-value shards`
                        : ""}
                    </span>
                  </div>
                );
              })}
              {actionRecipe.length === 0 && (
                <div className="rounded border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-sm font-black text-emerald-100">
                  No more upgrades needed.
                </div>
              )}
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              {selectedItem.isTestCostMode
                ? "Testing costs are active: each craft or upgrade uses 1 shard."
                : "Common shards substitute at 10 common for 1 missing shard."}
            </p>
          </div>

          <div className="rounded border border-slate-700 bg-slate-950/70 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              Shards
            </p>
            <div className="grid grid-cols-2 gap-2">
              {inventory.shards.map((shard) => {
                const isSelected = selectedShardKeys.includes(shard.key);

                return (
                  <button
                    className={`rounded border px-3 py-2 text-left text-sm font-black transition ${
                      isSelected
                        ? "bg-cyan-300 text-slate-950"
                        : "bg-slate-900 text-slate-300 hover:border-cyan-300/50"
                    }`}
                    key={shard.key}
                    onClick={() => toggleCraftShard(shard.key)}
                    style={{ borderColor: isSelected ? undefined : shard.theme?.accent }}
                    type="button"
                  >
                    {shard.category}
                    <span className="mt-1 block text-xs font-bold opacity-70">
                      {shard.quantity}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </PagePanel>
  );
}

function ShardSlot({
  costPerShard,
  csCurrency,
  isBuyingShard,
  onBuyShard,
  shard,
}) {
  const cost = Number(costPerShard) || 10;
  const maxAffordableQuantity = Math.max(1, Math.floor(Number(csCurrency) / cost));
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const safeQuantity = Math.max(1, Math.floor(Number(purchaseQuantity) || 1));
  const selectedQuantity = Math.min(safeQuantity, maxAffordableQuantity);
  const totalCost = selectedQuantity * cost;
  const canBuy = Number(csCurrency) >= totalCost && !isBuyingShard;

  function updatePurchaseQuantity(nextQuantity) {
    setPurchaseQuantity(
      Math.min(
        maxAffordableQuantity,
        Math.max(1, Math.floor(Number(nextQuantity) || 1)),
      ),
    );
  }

  return (
    <article
      className="rounded-lg border bg-slate-950/70 p-4 transition hover:-translate-y-0.5 hover:bg-slate-950"
      style={{
        borderColor: shard.theme?.accent,
        boxShadow: `0 0 24px ${shard.theme?.glow}`,
      }}
    >
      <div
        className="mb-4 flex aspect-square items-center justify-center rounded border bg-slate-950"
        style={{
          borderColor: shard.theme?.accent,
          background: `radial-gradient(circle at 50% 35%, ${shard.theme?.glow}, transparent 34%), linear-gradient(145deg, rgba(15,23,42,1), rgba(2,6,23,1))`,
        }}
      >
        <img
          alt=""
          className="h-16 w-16 object-contain drop-shadow-xl"
          src={shard.assetPath}
        />
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-black text-slate-100">
            {shard.displayName}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">
            {shard.category}
          </p>
        </div>
        <p
          className="shrink-0 rounded border bg-slate-900 px-2 py-1 text-lg font-black"
          style={{
            borderColor: shard.theme?.accent,
            color: shard.theme?.accent,
          }}
        >
          {shard.quantity.toLocaleString()}
        </p>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="grid h-8 grid-cols-[1.75rem_2.5rem_1.75rem] overflow-hidden rounded border border-slate-700 bg-slate-950">
          <button
            className="text-sm font-black text-slate-400 transition hover:bg-slate-900 hover:text-slate-100 disabled:text-slate-700"
            disabled={selectedQuantity <= 1 || isBuyingShard}
            onClick={() => updatePurchaseQuantity(selectedQuantity - 1)}
            type="button"
          >
            -
          </button>
          <input
            aria-label={`${shard.displayName} buy quantity`}
            className="w-full border-x border-slate-800 bg-transparent text-center text-xs font-black text-slate-200 outline-none"
            min="1"
            onChange={(event) => updatePurchaseQuantity(event.target.value)}
            type="number"
            value={selectedQuantity}
          />
          <button
            className="text-sm font-black text-slate-400 transition hover:bg-slate-900 hover:text-slate-100 disabled:text-slate-700"
            disabled={selectedQuantity >= maxAffordableQuantity || isBuyingShard}
            onClick={() => updatePurchaseQuantity(selectedQuantity + 1)}
            type="button"
          >
            +
          </button>
        </div>
        <button
          className="h-8 flex-1 rounded border border-slate-700 bg-slate-900/80 px-2 text-[11px] font-black uppercase tracking-wide text-emerald-200 transition hover:border-emerald-300/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/40 disabled:text-slate-600"
          disabled={!canBuy}
          onClick={() => onBuyShard(shard, selectedQuantity)}
          type="button"
        >
          {isBuyingShard ? "Buying..." : `Buy - ${totalCost} CS`}
        </button>
      </div>
    </article>
  );
}

function ChampionCardModal({
  activeChampion,
  champion,
  isSaving,
  onClose,
  onSetActive,
}) {
  if (!champion) {
    return null;
  }

  const isActiveChampion = activeChampion?.slug === champion.slug;
  const unlockProgress = champion.progress || {};
  const progressTotal = Number(unlockProgress.total) || 0;
  const progressRequired = Number(unlockProgress.required) || 100;
  const progressPercent = Math.min(
    100,
    Number(unlockProgress.percent) || 0,
  );
  const championLevel = Number(champion.level) || 0;
  const championMaxLevel = Number(champion.maxLevel) || 10;
  const shardBonusPercent = Number(champion.shardBonusPercent) || 0;
  const progressTitle = champion.isUnlocked ? "Champion Stats" : "Unlock Progress";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-6 backdrop-blur-sm">
      <section className="grid max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg border border-cyan-300/35 bg-slate-950 shadow-2xl shadow-cyan-950/40 md:grid-cols-[280px_1fr]">
        <div className="flex items-center justify-center border-b border-slate-800 bg-slate-900 p-5 md:border-b-0 md:border-r">
          <div className="aspect-square w-full max-w-60 overflow-hidden rounded border border-cyan-300/25 bg-slate-950 shadow-inner shadow-cyan-950/30">
            <img
              alt=""
              className="h-full w-full object-contain"
              src={champion.assetPath}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-widest text-cyan-200">
                Champion Card
              </p>
              <h2 className="mt-2 break-words text-4xl font-black tracking-normal text-slate-50">
                {champion.name}
              </h2>
              {champion.title && (
                <p className="mt-1 text-sm font-bold uppercase tracking-wide text-slate-500">
                  {champion.title}
                </p>
              )}
            </div>

            <button
              aria-label="Close champion card"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-700 text-xl font-black text-slate-300 transition hover:border-rose-300/60 hover:text-rose-200"
              onClick={onClose}
              type="button"
            >
              X
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Role
              </p>
              <p className="mt-2 text-xl font-black text-cyan-100">
                {champion.role || "Unknown"}
              </p>
            </div>
            <div className="rounded border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Region
              </p>
              <p className="mt-2 text-xl font-black text-amber-100">
                {champion.region || "Unknown"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded border border-slate-700 bg-slate-900 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {progressTitle}
              </p>
              <p className="text-sm font-black text-cyan-100">
                {champion.isUnlocked
                  ? `Level ${championLevel}/${championMaxLevel} - +${shardBonusPercent}% shards`
                  : `${progressTotal} / ${progressRequired}`}
              </p>
            </div>
            {!champion.isUnlocked && (
              <div className="mt-3 h-2 overflow-hidden rounded bg-slate-800">
                <div
                  className="h-full rounded bg-cyan-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
            <div
              className={`mt-3 grid gap-2 ${
                champion.isUnlocked ? "sm:grid-cols-2" : "sm:grid-cols-3"
              }`}
            >
              <div className="rounded border border-slate-700 bg-slate-950 px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {champion.isUnlocked ? "Total Picks" : "Picked"}
                </p>
                <p className="mt-1 text-lg font-black text-slate-100">
                  {Number(unlockProgress.played) || 0}
                </p>
              </div>
              <div className="rounded border border-slate-700 bg-slate-950 px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {champion.isUnlocked ? "Total Kills" : "Kills"}
                </p>
                <p className="mt-1 text-lg font-black text-slate-100">
                  {Number(unlockProgress.killed) || 0}
                </p>
              </div>
              {!champion.isUnlocked && (
                <div className="rounded border border-slate-700 bg-slate-950 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Remaining
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-100">
                    {Number(unlockProgress.remaining) || 0}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 min-h-0 overflow-y-auto rounded border border-slate-700 bg-slate-900 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Description
            </p>
            <p className="mt-3 text-base font-semibold leading-7 text-slate-300">
              {champion.description || "Champion details are coming soon."}
            </p>
          </div>

          <button
            className="mt-5 h-12 rounded bg-amber-400 px-5 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            disabled={!champion.isUnlocked || isActiveChampion || isSaving}
            onClick={() => onSetActive(champion)}
            type="button"
          >
            {isSaving
              ? "Saving..."
              : isActiveChampion
                ? "Active"
                : champion.isUnlocked
                  ? "Set Active"
                  : "Locked"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ItemCardModal({
  backpack,
  isSaving,
  item,
  onBackpackSlotSelected,
  onClose,
  onSetActive,
  pendingBackpackItem,
}) {
  if (!item) {
    return null;
  }

  const recipeRows = item.craftRecipe || item.recipe || [];
  const isInBackpack = (backpack || []).some((slot) => slot.item?.key === item.key);
  const replacementItem = pendingBackpackItem || item;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-6 backdrop-blur-sm">
      <section className="grid max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg border border-amber-300/35 bg-slate-950 shadow-2xl shadow-amber-950/40 md:grid-cols-[260px_1fr]">
        <div className="flex items-center justify-center border-b border-slate-800 bg-slate-900 p-5 md:border-b-0 md:border-r">
          <div className="aspect-square w-full max-w-56 rounded border border-amber-300/25 bg-slate-950 p-5 shadow-inner shadow-amber-950/30">
            <img
              alt=""
              className="h-full w-full object-contain"
              src={item.assetPath}
            />
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-widest text-amber-200">
                Crafted Item
              </p>
              <h2 className="mt-2 break-words text-3xl font-black tracking-normal text-slate-50">
                {item.name}
              </h2>
              <p className="mt-2 text-sm font-black uppercase tracking-wide text-cyan-200">
                {item.category?.label || "Item"} - Level {item.level}/{item.maxLevel}
              </p>
            </div>

            <button
              aria-label="Close item card"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-700 text-xl font-black text-slate-300 transition hover:border-rose-300/60 hover:text-rose-200"
              onClick={onClose}
              type="button"
            >
              X
            </button>
          </div>

          <p className="mt-4 text-sm font-semibold leading-6 text-slate-400">
            {item.description}
          </p>

          <div className="mt-5 rounded border border-slate-700 bg-slate-900 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              Stats
            </p>
            <div className="flex flex-wrap gap-2">
              {item.stats.map((stat) => (
                <span
                  className="rounded border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-sm font-black text-cyan-100"
                  key={stat.key}
                >
                  {stat.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded border border-slate-700 bg-slate-900 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              Craft Recipe
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {recipeRows.map((recipeRow) => (
                <div
                  className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
                  key={recipeRow.shardKey}
                >
                  <p className="text-sm font-black text-slate-100">
                    {recipeRow.label}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Required {recipeRow.required}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {pendingBackpackItem && (
            <div className="mt-4 rounded border border-amber-300/25 bg-amber-500/10 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-200">
                Replace Backpack Slot
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-300">
                Choose a slot for {replacementItem.name}.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(backpack || emptyLoadout.backpack).map((slot) => (
                  <button
                    className="flex aspect-square items-center justify-center rounded border border-slate-700 bg-slate-950 p-2 transition hover:border-amber-300/60 disabled:cursor-wait"
                    disabled={isSaving}
                    key={slot.slotIndex}
                    onClick={() => onBackpackSlotSelected(slot.slotIndex)}
                    type="button"
                  >
                    {slot.item ? (
                      <img
                        alt=""
                        className="h-full w-full object-contain"
                        src={slot.item.assetPath}
                        title={slot.item.name}
                      />
                    ) : (
                      <span className="text-xs font-black uppercase tracking-widest text-slate-700">
                        Empty
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            className="mt-5 h-12 w-full rounded bg-amber-400 px-5 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            disabled={!item.isOwned || isInBackpack || isSaving}
            onClick={() => onSetActive(item)}
            type="button"
          >
            {isSaving
              ? "Saving..."
              : isInBackpack
                ? "In Backpack"
                : "Set Active"}
          </button>
        </div>
      </section>
    </div>
  );
}

function RegionPointsModal({ isLoading, isOpen, onClose, regionProgress }) {
  if (!isOpen) {
    return null;
  }

  const regions = regionProgress?.regions || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-6 backdrop-blur-sm">
      <section className="w-full max-w-2xl rounded-lg border border-cyan-300/35 bg-slate-950 p-5 shadow-2xl shadow-cyan-950/40 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-cyan-200">
              Missions
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-normal text-slate-50">
              Region Points
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-400">
              {regionProgress?.totalPoints || 0} total points earned
            </p>
          </div>
          <button
            aria-label="Close region points"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-700 text-xl font-black text-slate-300 transition hover:border-rose-300/60 hover:text-rose-200"
            onClick={onClose}
            type="button"
          >
            X
          </button>
        </div>

        {isLoading ? (
          <div className="mt-6 flex min-h-48 items-center justify-center rounded border border-slate-800 bg-slate-900 text-sm font-bold uppercase tracking-widest text-slate-500">
            Loading regions...
          </div>
        ) : (
          <div className="mt-6 grid max-h-[56vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {regions.map((region) => (
              <div
                className="flex items-center justify-between gap-4 rounded border border-slate-700 bg-slate-900 p-4"
                key={region.key}
              >
                <p className="min-w-0 truncate text-base font-black text-slate-100">
                  {region.name}
                </p>
                <p className="shrink-0 rounded border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-lg font-black text-cyan-100">
                  {Number(region.points || 0).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RewardModal({ claim, stage, onNext, onDone, isRefreshing }) {
  if (!claim) {
    return null;
  }

  const metrics = [
    { label: "Overall KDA", value: claim.stats.overallKda },
    { label: "Total Victories", value: claim.stats.totalVictories },
    { label: "Total Items Built", value: claim.stats.totalItemsBuilt },
    { label: "CS Earned", value: claim.stats.totalCreepScore || 0 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-6 backdrop-blur-sm">
      <section className="w-full max-w-2xl rounded-lg border border-amber-300/35 bg-slate-950 p-5 shadow-2xl shadow-amber-950/40 sm:p-6">
        {stage === 1 ? (
          <>
            <h2 className="text-3xl font-black tracking-normal text-slate-50">
              New Matches Discovered!
            </h2>
            <p className="mt-3 text-base font-semibold text-slate-300">
              Found {claim.matchCount} games since your last checkpoint.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              {metrics.map((metric) => (
                <div
                  className="rounded border border-slate-700 bg-slate-900 p-4 text-center"
                  key={metric.label}
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-3xl font-black text-cyan-100">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>

            <button
              className="mt-6 h-12 w-full rounded bg-amber-400 px-5 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300 active:scale-[0.99]"
              onClick={onNext}
              type="button"
            >
              Next
            </button>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-black tracking-normal text-slate-50">
              Rewards Acquired
            </h2>

            <div className="mt-6 grid max-h-[52vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {claim.breakdown.map((reward, index) => (
                <div
                  className="flex min-h-16 items-center gap-3 rounded border border-slate-700 bg-slate-900 p-3"
                  key={`${reward.text}-${index}`}
                  style={{
                    borderColor: reward.theme?.accent,
                    boxShadow: reward.theme
                      ? `0 0 18px ${reward.theme.glow}`
                      : undefined,
                  }}
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-amber-300/40 bg-slate-950 text-xs font-black text-amber-200"
                    style={{
                      borderColor: reward.theme?.accent,
                      color: reward.theme?.accent,
                    }}
                  >
                    {reward.assetPath ? (
                      <img
                        alt=""
                        className="h-8 w-8 object-contain"
                        src={reward.assetPath}
                      />
                    ) : (
                      reward.iconText || "XP"
                    )}
                  </div>
                  <p className="min-w-0 break-words text-lg font-black text-slate-100">
                    {reward.text}
                  </p>
                </div>
              ))}
            </div>

            <button
              className="mt-6 h-12 w-full rounded bg-amber-400 px-5 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300 active:scale-[0.99] disabled:cursor-wait disabled:bg-slate-600 disabled:text-slate-300"
              disabled={isRefreshing}
              onClick={onDone}
              type="button"
            >
              {isRefreshing ? "Refreshing..." : "Done"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
