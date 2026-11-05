using System;
using UnityEngine;

namespace ChahanGame
{
    public enum GamePhase
    {
        Ready,
        Cooking,
        Ladled,
        Result
    }

    /// <summary>
    /// 調理の熱力学シミュレーションおよびゲーム進行マネージャー
    /// </summary>
    public class CookingThermodynamics : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private TossGestureDetector gestureDetector;
        [SerializeField] private RiceParticleController riceController;

        [Header("Cook Thermodynamics")]
        [Tooltip("強火バーナーによる熱量上昇速度（毎秒）")]
        [SerializeField] private float burnerPower = 11.0f;
        [Tooltip("放熱・煽りによる冷却速度")]
        [SerializeField] private float tossCoolingPower = 14.0f;
        [Tooltip("焦げ付き始める温度閾値")]
        [SerializeField] private float burnThreshold = 82.0f;

        [Header("Game Time")]
        [SerializeField] private float timeLimit = 45.0f;

        // 公開ステータス
        public GamePhase CurrentPhase { get; private set; } = GamePhase.Ready;
        public float RemainingTime { get; private set; }
        public float Dryness { get; private set; } // 0〜100 (パラパラ度)
        public float Heat { get; private set; }    // 0〜100 (鍋底熱量)
        public float BurnAccumulation { get; private set; }
        public int Combo { get; private set; }
        public int MaxCombo { get; private set; }
        public bool IsWokHeiActive { get; private set; }
        public int WokHeiTossCount { get; private set; }

        // 投入タイミング記録（経過秒数）
        public float EggTime { get; private set; } = -1f;
        public float RiceTime { get; private set; } = -1f;
        public float MeatTime { get; private set; } = -1f;
        public float OnionTime { get; private set; } = -1f;
        public float SoyTime { get; private set; } = -1f;

        public event Action<GamePhase> OnPhaseChanged;
        public event Action<string, Color> OnFeedbackMessage;

        private void Start()
        {
            if (gestureDetector != null)
            {
                gestureDetector.OnWokTossed += HandleToss;
                gestureDetector.OnWokFlipped += HandleFlip;
            }
        }

        private void OnDestroy()
        {
            if (gestureDetector != null)
            {
                gestureDetector.OnWokTossed -= HandleToss;
                gestureDetector.OnWokFlipped -= HandleFlip;
            }
        }

        public void StartGame()
        {
            CurrentPhase = GamePhase.Cooking;
            RemainingTime = timeLimit;
            Dryness = 0f;
            Heat = 30f;
            BurnAccumulation = 0f;
            Combo = 0;
            MaxCombo = 0;
            IsWokHeiActive = false;
            WokHeiTossCount = 0;

            EggTime = -1f;
            RiceTime = -1f;
            MeatTime = -1f;
            OnionTime = -1f;
            SoyTime = -1f;

            OnPhaseChanged?.Invoke(CurrentPhase);
            OnFeedbackMessage?.Invoke("熱々の油に卵を投入せよ！", new Color(1f, 0.8f, 0.2f));
        }

        private void Update()
        {
            if (CurrentPhase != GamePhase.Cooking) return;

            float dt = Time.deltaTime;
            RemainingTime -= dt;

            if (RemainingTime <= 0f)
            {
                RemainingTime = 0f;
                FinishCooking();
                return;
            }

            // 熱量の自然上昇
            Heat = Mathf.Min(100f, Heat + burnerPower * dt);

            // 焦げの蓄積
            if (Heat > burnThreshold)
            {
                BurnAccumulation += (Heat - burnThreshold) * 0.15f * dt;
            }

            // 米粒のマテリアル色更新 (0.1: 白, 0.5: 黄, 1.0: 黄金パラパラ, 2.0: 焦げ)
            UpdateRiceCookVisual();
        }

        private void UpdateRiceCookVisual()
        {
            if (riceController == null) return;

            float state = 0.2f;
            if (BurnAccumulation > 8f)
            {
                state = 2.0f; // コゲ
            }
            else if (Dryness > 55f)
            {
                state = 1.0f; // 黄金パラパラ
            }
            else if (RiceTime > 0)
            {
                state = 0.5f; // 卵絡み黄色
            }

            riceController.UpdateCookStates(state);
        }

        // --- 煽り（Toss）ハンドリング ---
        private void HandleToss(TossEventData toss)
        {
            if (CurrentPhase != GamePhase.Cooking) return;

            // 米粒物理へインパルスを適用
            if (riceController != null)
            {
                riceController.ApplyWokToss(toss);
            }

            // 熱量の放熱
            Heat = Mathf.Max(10f, Heat - tossCoolingPower * toss.Power);

            // リズム＆パラパラ度判定
            if (toss.IsPerfectRhythm)
            {
                Combo++;
                if (Combo > MaxCombo) MaxCombo = Combo;
                Dryness = Mathf.Min(100f, Dryness + 3.8f);
                OnFeedbackMessage?.Invoke($"PERFECT RHYTHM! ({Combo} COMBO)", Color.green);
            }
            else
            {
                Combo = 0;
                Dryness = Mathf.Min(100f, Dryness + 1.8f);
                OnFeedbackMessage?.Invoke("GOOD TOSS!", Color.yellow);
            }

            // 鑊気煽り判定
            if (IsWokHeiActive)
            {
                WokHeiTossCount++;
            }
        }

        // --- 具材投入 ---
        public void AddEgg()
        {
            if (CurrentPhase != GamePhase.Cooking || EggTime >= 0) return;
            EggTime = timeLimit - RemainingTime;
            OnFeedbackMessage?.Invoke("半熟のうちにご飯を入れろ！", Color.yellow);
        }

        public void AddRice()
        {
            if (CurrentPhase != GamePhase.Cooking || EggTime < 0 || RiceTime >= 0) return;
            RiceTime = timeLimit - RemainingTime;

            float eggRiceDiff = RiceTime - EggTime;
            if (eggRiceDiff >= 1.2f && eggRiceDiff <= 3.2f)
            {
                OnFeedbackMessage?.Invoke("黄金コーティング成功！(PERFECT)", Color.green);
            }
            else
            {
                OnFeedbackMessage?.Invoke("米投入！鍋をあおってほぐせ！", Color.yellow);
            }
        }

        public void AddMeat()
        {
            if (CurrentPhase != GamePhase.Cooking || RiceTime < 0 || MeatTime >= 0) return;
            MeatTime = timeLimit - RemainingTime;
            OnFeedbackMessage?.Invoke("チャーシュー投入！", new Color(1f, 0.5f, 0.1f));
        }

        public void AddOnion()
        {
            if (CurrentPhase != GamePhase.Cooking || RiceTime < 0 || OnionTime >= 0) return;
            OnionTime = timeLimit - RemainingTime;

            if (RemainingTime <= 10f && RemainingTime >= 3f)
            {
                OnFeedbackMessage?.Invoke("シャキシャキネギ！(PERFECT)", Color.green);
            }
            else
            {
                OnFeedbackMessage?.Invoke("ネギ投入！", Color.cyan);
            }
        }

        public void AddSoyOnRim()
        {
            if (CurrentPhase != GamePhase.Cooking || RiceTime < 0 || SoyTime >= 0) return;
            SoyTime = timeLimit - RemainingTime;
            IsWokHeiActive = true;
            WokHeiTossCount = 0;
            OnFeedbackMessage?.Invoke("鍋肌醤油！即座に煽って香りを閉じ込めろ！", new Color(1f, 0.3f, 0.1f));
        }

        public void GatherLadle()
        {
            if (CurrentPhase != GamePhase.Cooking || RiceTime < 0) return;
            CurrentPhase = GamePhase.Ladled;
            riceController.GatherIntoLadle();
            OnPhaseChanged?.Invoke(CurrentPhase);
            OnFeedbackMessage?.Invoke("端末をパカッと裏返して皿へ盛れ！", new Color(0.3f, 0.7f, 1f));
        }

        private void HandleFlip()
        {
            if (CurrentPhase != GamePhase.Ladled) return;
            FinishCooking();
        }

        private void FinishCooking()
        {
            CurrentPhase = GamePhase.Result;
            OnPhaseChanged?.Invoke(CurrentPhase);
        }
    }
}
