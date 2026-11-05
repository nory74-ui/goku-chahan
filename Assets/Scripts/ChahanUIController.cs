using UnityEngine;
using UnityEngine.UI;

namespace ChahanGame
{
    /// <summary>
    /// ゲームUIと操作ボタンの表示・連携を管理するクラス
    /// </summary>
    public class ChahanUIController : MonoBehaviour
    {
        [Header("Manager Reference")]
        [SerializeField] private CookingThermodynamics cookingManager;

        [Header("Status UI")]
        [SerializeField] private Text timeText;
        [SerializeField] private Text comboText;
        [SerializeField] private Text feedbackText;
        [SerializeField] private Slider drynessSlider;
        [SerializeField] private Slider heatSlider;

        [Header("Ingredient Buttons")]
        [SerializeField] private Button eggButton;
        [SerializeField] private Button riceButton;
        [SerializeField] private Button meatButton;
        [SerializeField] private Button onionButton;
        [SerializeField] private Button soyButton;
        [SerializeField] private Button ladleButton;

        [Header("Result Panel")]
        [SerializeField] private GameObject resultPanel;
        [SerializeField] private Text resultScoreText;
        [SerializeField] private Text resultRankText;
        [SerializeField] private Text resultTitleText;
        [SerializeField] private Text resultCommentText;
        [SerializeField] private Button retryButton;

        private void Start()
        {
            BindButtons();

            if (cookingManager != null)
            {
                cookingManager.OnPhaseChanged += HandlePhaseChanged;
                cookingManager.OnFeedbackMessage += HandleFeedback;
            }

            if (resultPanel != null)
            {
                resultPanel.SetActive(false);
            }
        }

        private void OnDestroy()
        {
            if (cookingManager != null)
            {
                cookingManager.OnPhaseChanged -= HandlePhaseChanged;
                cookingManager.OnFeedbackMessage -= HandleFeedback;
            }
        }

        private void BindButtons()
        {
            if (eggButton != null) eggButton.onClick.AddListener(() => {
                cookingManager.AddEgg();
                eggButton.interactable = false;
                if (riceButton != null) riceButton.interactable = true;
            });

            if (riceButton != null) riceButton.onClick.AddListener(() => {
                cookingManager.AddRice();
                riceButton.interactable = false;
                if (meatButton != null) meatButton.interactable = true;
                if (onionButton != null) onionButton.interactable = true;
                if (soyButton != null) soyButton.interactable = true;
                if (ladleButton != null) ladleButton.interactable = true;
            });

            if (meatButton != null) meatButton.onClick.AddListener(() => {
                cookingManager.AddMeat();
                meatButton.interactable = false;
            });

            if (onionButton != null) onionButton.onClick.AddListener(() => {
                cookingManager.AddOnion();
                onionButton.interactable = false;
            });

            if (soyButton != null) soyButton.onClick.AddListener(() => {
                cookingManager.AddSoyOnRim();
                soyButton.interactable = false;
            });

            if (ladleButton != null) ladleButton.onClick.AddListener(() => {
                cookingManager.GatherLadle();
                ladleButton.interactable = false;
            });

            if (retryButton != null) retryButton.onClick.AddListener(() => {
                if (resultPanel != null) resultPanel.SetActive(false);
                ResetButtons();
                cookingManager.StartGame();
            });

            ResetButtons();
        }

        private void ResetButtons()
        {
            if (eggButton != null) eggButton.interactable = true;
            if (riceButton != null) riceButton.interactable = false;
            if (meatButton != null) meatButton.interactable = false;
            if (onionButton != null) onionButton.interactable = false;
            if (soyButton != null) soyButton.interactable = false;
            if (ladleButton != null) ladleButton.interactable = false;
        }

        private void Update()
        {
            if (cookingManager == null) return;

            // ステータス更新
            if (timeText != null)
            {
                timeText.text = Mathf.CeilToInt(cookingManager.RemainingTime).ToString();
            }

            if (comboText != null)
            {
                comboText.text = (cookingManager.Combo > 0) ? $"COMBO {cookingManager.Combo}" : "";
            }

            if (drynessSlider != null)
            {
                drynessSlider.value = cookingManager.Dryness / 100f;
            }

            if (heatSlider != null)
            {
                heatSlider.value = cookingManager.Heat / 100f;
            }
        }

        private void HandleFeedback(string message, Color color)
        {
            if (feedbackText != null)
            {
                feedbackText.text = message;
                feedbackText.color = color;
            }
        }

        private void HandlePhaseChanged(GamePhase phase)
        {
            if (phase == GamePhase.Result)
            {
                ShowResult();
            }
        }

        private void ShowResult()
        {
            CookingResult result = ScoreEvaluator.Evaluate(cookingManager);

            if (resultPanel != null)
            {
                resultPanel.SetActive(true);
            }

            if (resultScoreText != null) resultScoreText.text = $"{result.TotalScore} / 100";
            if (resultRankText != null) resultRankText.text = result.Rank;
            if (resultTitleText != null) resultTitleText.text = result.Title;
            if (resultCommentText != null) resultCommentText.text = result.Comment;
        }
    }
}
