using System;
using UnityEngine;

namespace ChahanGame
{
    [Serializable]
    public struct CookingResult
    {
        public int TotalScore;
        public string Rank;
        public string Title;
        public string Comment;

        public int DrynessScore;   // max 25
        public int HeatScore;      // max 20
        public int CoatingScore;   // max 15
        public int TimingScore;    // max 15
        public int WokHeiScore;    // max 15
        public int PlatingScore;   // max 10

        public float[] RadarValues; // 0.0 〜 1.0 (5軸)
    }

    /// <summary>
    /// 調理結果の総合評価とレーダーチャート用データ生成を行うクラス
    /// </summary>
    public static class ScoreEvaluator
    {
        public static CookingResult Evaluate(CookingThermodynamics cooking)
        {
            // 1. パラパラ度 (25点満点)
            int drynessScore = Mathf.RoundToInt(Mathf.Clamp01(cooking.Dryness / 100f) * 25f);

            // 2. 焼き加減 (20点満点)
            int heatScore = 20;
            if (cooking.BurnAccumulation > 3f)
            {
                heatScore = Mathf.Max(0, 20 - Mathf.RoundToInt(cooking.BurnAccumulation * 1.5f));
            }

            // 3. 卵・米コーティング (15点満点)
            int coatingScore = 15;
            if (cooking.EggTime < 0 || cooking.RiceTime < 0)
            {
                coatingScore = 0;
            }
            else
            {
                float eggRiceDiff = cooking.RiceTime - cooking.EggTime;
                if (eggRiceDiff < 1.0f || eggRiceDiff > 3.8f)
                {
                    coatingScore = 6;
                }
            }

            // 4. 具材＆ネギ鮮度 (15点満点)
            int timingScore = 15;
            if (cooking.MeatTime < 0) timingScore -= 7;
            if (cooking.OnionTime < 0)
            {
                timingScore -= 8;
            }
            else if (cooking.OnionTime < 28f) // 早すぎる投入
            {
                timingScore -= 4;
            }

            // 5. 鑊気スコア (15点満点)
            int wokheiScore = 0;
            if (cooking.SoyTime > 0)
            {
                wokheiScore = Mathf.Min(15, 6 + cooking.WokHeiTossCount * 3);
            }

            // 6. 盛り付けスコア (10点満点)
            int platingScore = (cooking.CurrentPhase == GamePhase.Result) ? 10 : 3;

            // 総合得点 (100点満点)
            int total = Mathf.Clamp(drynessScore + heatScore + coatingScore + timingScore + wokheiScore + platingScore, 0, 100);

            // ランク・称号・コメント
            string rank = "D";
            string title = "まかない落第";
            string comment = "「ベチャベチャ（または丸焦げ）だ！修業し直してこい！」";

            if (total >= 92)
            {
                rank = "S";
                title = "町中華の生ける伝説";
                comment = "「完璧だ…！米一粒一粒に卵が宿り、鑊気が鼻腔を突き抜ける至高の一皿！」";
            }
            else if (total >= 78)
            {
                rank = "A";
                title = "一流中華の料理長";
                comment = "「見事なパラパラ感と香ばしさ！ネギのシャキシャキ感も最高だ。」";
            }
            else if (total >= 60)
            {
                rank = "B";
                title = "一人前の料理人";
                comment = "「うん、うまい！次は鍋肌醤油のタイミングをもっと極めてみよう。」";
            }
            else if (total >= 45)
            {
                rank = "C";
                title = "見習いコック";
                comment = "「少し油っこいか…？具材を入れる順番と秒数を意識するんじゃ。」";
            }

            // レーダーチャート用（0.0〜1.0 に正規化）
            float[] radar = new float[]
            {
                drynessScore / 25f,
                heatScore / 20f,
                (coatingScore + timingScore) / 30f,
                wokheiScore / 15f,
                platingScore / 10f
            };

            return new CookingResult
            {
                TotalScore = total,
                Rank = rank,
                Title = title,
                Comment = comment,
                DrynessScore = drynessScore,
                HeatScore = heatScore,
                CoatingScore = coatingScore,
                TimingScore = timingScore,
                WokHeiScore = wokheiScore,
                PlatingScore = platingScore,
                RadarValues = radar
            };
        }
    }
}
