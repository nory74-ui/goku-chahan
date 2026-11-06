using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;

namespace ChahanGame.Editor
{
    public static class SceneSetupHelper
    {
        private static Mesh LoadMeshFromFbx(string fbxPath)
        {
            var assets = AssetDatabase.LoadAllAssetsAtPath(fbxPath);
            foreach (var a in assets)
            {
                if (a is Mesh m && !m.name.Contains("preview"))
                {
                    return m;
                }
            }
            return null;
        }

        [MenuItem("Chahan Game/Setup Photoreal Scene (Blenderリアルモデル適用)")]
        public static void BuildSceneBatch()
        {
            Debug.Log("[ChahanGame] Blender製FBXリアルアセットのシーン組み込みを開始します...");

            // 1. テクスチャのロード
            Texture2D normalMap = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Textures/wok_hammer_normal.png");
            Texture2D wokTex = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Textures/wok_diffuse.jpg");
            Texture2D riceTex = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Textures/rice_diffuse.jpg");
            Texture2D meatTex = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Textures/meat_diffuse.jpg");
            Texture2D onionTex = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Textures/onion_diffuse.jpg");
            Texture2D eggTex = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Textures/egg_diffuse.jpg");

            if (normalMap != null)
            {
                TextureImporter importer = AssetImporter.GetAtPath("Assets/Textures/wok_hammer_normal.png") as TextureImporter;
                if (importer != null && importer.textureType != TextureImporterType.NormalMap)
                {
                    importer.textureType = TextureImporterType.NormalMap;
                    importer.SaveAndReimport();
                }
            }

            // 2. Blender製FBXメッシュのロード
            Mesh wokFbxMesh = LoadMeshFromFbx("Assets/Models/real_wok.fbx");
            Mesh riceFbxMesh = LoadMeshFromFbx("Assets/Models/real_rice.fbx");
            Mesh meatFbxMesh = LoadMeshFromFbx("Assets/Models/real_meat.fbx");
            Mesh onionFbxMesh = LoadMeshFromFbx("Assets/Models/real_onion.fbx");
            Mesh eggFbxMesh = LoadMeshFromFbx("Assets/Models/real_egg.fbx");

            // 3. マテリアル設定 (実写PBRフォトリアルテクスチャを全適用)
            // ① 米粒 (Photoreal SSS + Oil Clearcoat + 実写テクスチャ)
            Shader riceShader = Shader.Find("Custom/PhotorealRice");
            if (riceShader == null) riceShader = Shader.Find("Standard");
            Material riceMat = new Material(riceShader);
            if (riceTex != null) riceMat.mainTexture = riceTex;
            riceMat.enableInstancing = true;
            AssetDatabase.CreateAsset(riceMat, "Assets/Materials/RiceInstancedMaterial.mat");

            // ② 中華鍋 (実写黒光り油膜PBR ＋ 打出しハンマー痕ノーマルマップ)
            Material wokMat = new Material(Shader.Find("Standard"));
            if (wokTex != null) wokMat.mainTexture = wokTex;
            wokMat.color = Color.white;
            wokMat.SetFloat("_Metallic", 0.88f);
            wokMat.SetFloat("_Glossiness", 0.82f);
            if (normalMap != null)
            {
                wokMat.SetTexture("_BumpMap", normalMap);
                wokMat.SetFloat("_BumpScale", 0.6f);
                wokMat.EnableKeyword("_NORMALMAP");
            }
            AssetDatabase.CreateAsset(wokMat, "Assets/Materials/WokIronMaterial.mat");

            // ③ チャーシュー (実写タレ照り ＋ 赤身繊維PBR)
            Material meatMat = new Material(Shader.Find("Standard"));
            if (meatTex != null) meatMat.mainTexture = meatTex;
            meatMat.color = Color.white;
            meatMat.SetFloat("_Glossiness", 0.62f);
            meatMat.SetFloat("_Metallic", 0.08f);
            meatMat.enableInstancing = true;
            AssetDatabase.CreateAsset(meatMat, "Assets/Materials/MeatMaterial.mat");

            // ④ 長ネギ (実写中空リング ＋ 水分にじむ断面PBR)
            Material onionMat = new Material(Shader.Find("Standard"));
            if (onionTex != null) onionMat.mainTexture = onionTex;
            onionMat.color = Color.white;
            onionMat.SetFloat("_Glossiness", 0.65f);
            onionMat.enableInstancing = true;
            AssetDatabase.CreateAsset(onionMat, "Assets/Materials/OnionMaterial.mat");

            // ⑤ 炒り卵 (実写ふんわり半熟イエローPBR)
            Material eggMat = new Material(Shader.Find("Standard"));
            if (eggTex != null) eggMat.mainTexture = eggTex;
            eggMat.color = Color.white;
            eggMat.SetFloat("_Glossiness", 0.52f);
            eggMat.enableInstancing = true;
            AssetDatabase.CreateAsset(eggMat, "Assets/Materials/EggMaterial.mat");

            AssetDatabase.SaveAssets();

            // 4. 音響ロード
            AudioClip tossClip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Audio/toss.wav");
            AudioClip sizzleClip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Audio/sizzle.wav");
            AudioClip addClip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Audio/add.wav");
            AudioClip soyClip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Audio/soy.wav");
            AudioClip platingClip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Audio/plating.wav");
            AudioClip wokHeiClip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Audio/wokhei.wav");

            // 5. 新規シーン構築
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            // カメラ配置 (至近距離マクロ視点)
            GameObject camObj = new GameObject("Main Camera");
            camObj.tag = "MainCamera";
            Camera cam = camObj.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.05f, 0.05f, 0.07f);
            cam.fieldOfView = 48f;
            camObj.transform.position = new Vector3(0f, 3.1f, -1.7f);
            camObj.transform.rotation = Quaternion.Euler(61f, 0f, 0f);
            camObj.AddComponent<AudioListener>();

            // ライティング構築 (厨房の映画調ライティング)
            GameObject mainLight = new GameObject("Key Directional Light");
            Light keyL = mainLight.AddComponent<Light>();
            keyL.type = LightType.Directional;
            keyL.color = new Color(1f, 0.94f, 0.86f);
            keyL.intensity = 1.35f;
            mainLight.transform.rotation = Quaternion.Euler(52f, -35f, 0f);

            GameObject fillLight = new GameObject("Fill Directional Light");
            Light fillL = fillLight.AddComponent<Light>();
            fillL.type = LightType.Directional;
            fillL.color = new Color(0.75f, 0.85f, 1.0f);
            fillL.intensity = 0.35f;
            fillLight.transform.rotation = Quaternion.Euler(30f, 145f, 0f);

            // ガス炎ライト
            GameObject burnerObj = new GameObject("GasBurnerFlameLight");
            burnerObj.transform.position = new Vector3(0f, -0.2f, 0f);
            Light flameL = burnerObj.AddComponent<Light>();
            flameL.type = LightType.Point;
            flameL.color = new Color(0.1f, 0.45f, 1.0f);
            flameL.intensity = 1.6f;
            flameL.range = 3.5f;

            // 鍋底ヒートグローライト
            GameObject glowObj = new GameObject("WokThermalGlowLight");
            glowObj.transform.position = new Vector3(0f, 0.1f, 0f);
            Light glowL = glowObj.AddComponent<Light>();
            glowL.type = LightType.Point;
            glowL.color = new Color(1f, 0.3f, 0.05f);
            glowL.intensity = 0.8f;
            glowL.range = 2.5f;

            // リフレクションプローブ
            GameObject probeObj = new GameObject("KitchenReflectionProbe");
            probeObj.transform.position = new Vector3(0f, 0.8f, 0f);
            ReflectionProbe probe = probeObj.AddComponent<ReflectionProbe>();
            probe.size = new Vector3(6f, 6f, 6f);
            probe.mode = UnityEngine.Rendering.ReflectionProbeMode.Realtime;
            probe.refreshMode = UnityEngine.Rendering.ReflectionProbeRefreshMode.OnAwake;

            // 6. 中華鍋の配置 (Blender製FBXモデル)
            GameObject wokObj = new GameObject("RealChahanWok");
            var wokFilter = wokObj.AddComponent<MeshFilter>();
            wokFilter.sharedMesh = wokFbxMesh;
            var wokRenderer = wokObj.AddComponent<MeshRenderer>();
            wokRenderer.sharedMaterial = wokMat;
            wokObj.transform.position = Vector3.zero;

            // 7. GameManager配置
            GameObject gmObj = new GameObject("GameManager");
            var tossDetector = gmObj.AddComponent<TossGestureDetector>();
            var riceController = gmObj.AddComponent<RiceParticleController>();
            var audioMgr = gmObj.AddComponent<ChahanAudioManager>();
            var thermo = gmObj.AddComponent<CookingThermodynamics>();
            var uiController = gmObj.AddComponent<ChahanUIController>();

            var burnerEffect = gmObj.AddComponent<GasBurnerEffect>();
            var serBurner = new SerializedObject(burnerEffect);
            serBurner.FindProperty("flameLight").objectReferenceValue = flameL;
            serBurner.FindProperty("glowLight").objectReferenceValue = glowL;
            serBurner.FindProperty("cookingManager").objectReferenceValue = thermo;
            serBurner.FindProperty("wokRenderer").objectReferenceValue = wokRenderer;
            serBurner.ApplyModifiedProperties();

            AudioSource sfxSrc = gmObj.AddComponent<AudioSource>();
            sfxSrc.playOnAwake = false;
            AudioSource loopSrc = gmObj.AddComponent<AudioSource>();
            loopSrc.playOnAwake = false;

            var serAudio = new SerializedObject(audioMgr);
            serAudio.FindProperty("tossClip").objectReferenceValue = tossClip;
            serAudio.FindProperty("sizzleClip").objectReferenceValue = sizzleClip;
            serAudio.FindProperty("addClip").objectReferenceValue = addClip;
            serAudio.FindProperty("soyClip").objectReferenceValue = soyClip;
            serAudio.FindProperty("platingClip").objectReferenceValue = platingClip;
            serAudio.FindProperty("wokHeiClip").objectReferenceValue = wokHeiClip;
            serAudio.FindProperty("sfxSource").objectReferenceValue = sfxSrc;
            serAudio.FindProperty("loopSource").objectReferenceValue = loopSrc;
            serAudio.ApplyModifiedProperties();

            // RiceParticleController 設定 (Blender製FBXメッシュをバインド！)
            var serRice = new SerializedObject(riceController);
            serRice.FindProperty("riceMesh").objectReferenceValue = riceFbxMesh;
            serRice.FindProperty("riceMaterial").objectReferenceValue = riceMat;
            serRice.FindProperty("meatMesh").objectReferenceValue = meatFbxMesh;
            serRice.FindProperty("meatMaterial").objectReferenceValue = meatMat;
            serRice.FindProperty("onionMesh").objectReferenceValue = onionFbxMesh;
            serRice.FindProperty("onionMaterial").objectReferenceValue = onionMat;
            serRice.FindProperty("eggMesh").objectReferenceValue = eggFbxMesh;
            serRice.FindProperty("eggMaterial").objectReferenceValue = eggMat;

            serRice.FindProperty("maxRiceCount").intValue = 800;
            serRice.FindProperty("maxMeatCount").intValue = 28;
            serRice.FindProperty("maxOnionCount").intValue = 36;
            serRice.FindProperty("maxEggCount").intValue = 32;
            serRice.ApplyModifiedProperties();

            var serThermo = new SerializedObject(thermo);
            serThermo.FindProperty("gestureDetector").objectReferenceValue = tossDetector;
            serThermo.FindProperty("riceController").objectReferenceValue = riceController;
            serThermo.FindProperty("audioManager").objectReferenceValue = audioMgr;
            serThermo.ApplyModifiedProperties();

            // UI構築
            BuildUIHierarchy(canvasObjOut: out Canvas canvas,
                             uiCtrl: uiController,
                             thermo: thermo,
                             font: Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"));

            EditorSceneManager.SaveScene(scene, "Assets/Scenes/MainChahanScene.unity");
            Debug.Log("[ChahanGame] Blender製FBXリアルモデル群のシーン構築が完了しました！Assets/Scenes/MainChahanScene.unity");
        }

        private static void BuildUIHierarchy(out Canvas canvasObjOut, ChahanUIController uiCtrl, CookingThermodynamics thermo, Font font)
        {
            GameObject canvasObj = new GameObject("Canvas");
            canvasObjOut = canvasObj.AddComponent<Canvas>();
            canvasObjOut.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasObj.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080, 1920);
            scaler.matchWidthOrHeight = 0.5f;
            canvasObj.AddComponent<GraphicRaycaster>();

            GameObject eventSystem = new GameObject("EventSystem");
            eventSystem.AddComponent<UnityEngine.EventSystems.EventSystem>();
            eventSystem.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();

            // 上部HUD
            GameObject topHud = CreateUIPanel(canvasObj, "TopHUD", new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0, -120), new Vector2(0, 240));
            Text timeText = CreateUIText(topHud, "TimeText", "45", font, 52, FontStyle.Bold, Color.yellow, new Vector2(0.1f, 0.5f), new Vector2(120, 80));
            Text comboText = CreateUIText(topHud, "ComboText", "COMBO 0", font, 36, FontStyle.Bold, new Color(1f, 0.6f, 0.1f), new Vector2(0.5f, 0.7f), new Vector2(300, 60));
            Text feedbackText = CreateUIText(topHud, "FeedbackText", "READY", font, 34, FontStyle.Bold, Color.green, new Vector2(0.5f, 0.28f), new Vector2(700, 60));

            Slider drySlider = CreateUISlider(topHud, "DrynessSlider", new Vector2(0.3f, -40), new Vector2(260, 24), new Color(0.2f, 0.6f, 1f));
            Slider heatSlider = CreateUISlider(topHud, "HeatSlider", new Vector2(0.7f, -40), new Vector2(260, 24), new Color(1f, 0.3f, 0.2f));

            // 下部ボタン
            GameObject botHud = CreateUIPanel(canvasObj, "BottomHUD", new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(0, 220), new Vector2(0, 440));
            Button eggBtn = CreateUIButton(botHud, "EggBtn", "🥚 溶き卵", font, 28, new Vector2(-360, 80), new Vector2(220, 110));
            Button riceBtn = CreateUIButton(botHud, "RiceBtn", "🍚 ご飯", font, 28, new Vector2(-120, 80), new Vector2(220, 110));
            Button meatBtn = CreateUIButton(botHud, "MeatBtn", "🥩 肉", font, 28, new Vector2(120, 80), new Vector2(220, 110));
            Button onionBtn = CreateUIButton(botHud, "OnionBtn", "🌱 ネギ", font, 28, new Vector2(360, 80), new Vector2(220, 110));

            Button soyBtn = CreateUIButton(botHud, "SoyBtn", "🍶 鍋肌醤油", font, 30, new Vector2(-220, -50), new Vector2(360, 110), new Color(0.45f, 0.2f, 0.12f));
            Button ladleBtn = CreateUIButton(botHud, "LadleBtn", "🥄 お玉まとめ", font, 30, new Vector2(220, -50), new Vector2(360, 110), new Color(0.18f, 0.32f, 0.5f));

            // リザルトパネル
            GameObject resultPanel = CreateUIPanel(canvasObj, "ResultPanel", new Vector2(0f, 0f), new Vector2(1f, 1f), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero, new Color(0.05f, 0.05f, 0.08f, 0.94f));
            Text rankText = CreateUIText(resultPanel, "RankText", "S", font, 110, FontStyle.Bold, Color.yellow, new Vector2(0.5f, 0.78f), new Vector2(200, 140));
            Text titleText = CreateUIText(resultPanel, "TitleText", "町中華の生ける伝説", font, 46, FontStyle.Bold, Color.white, new Vector2(0.5f, 0.68f), new Vector2(700, 80));
            Text scoreText = CreateUIText(resultPanel, "ScoreText", "96 / 100", font, 54, FontStyle.Bold, new Color(1f, 0.8f, 0.2f), new Vector2(0.5f, 0.56f), new Vector2(500, 80));
            Text commentText = CreateUIText(resultPanel, "CommentText", "「完璧だ…！至高の一皿！」", font, 30, FontStyle.Normal, Color.white, new Vector2(0.5f, 0.42f), new Vector2(750, 160));
            Button retryBtn = CreateUIButton(resultPanel, "RetryBtn", "もう一丁作る！", font, 36, new Vector2(0, -320), new Vector2(400, 120), new Color(0.9f, 0.6f, 0.1f));

            resultPanel.SetActive(false);

            // ChahanUIController バインド
            var serUI = new SerializedObject(uiCtrl);
            serUI.FindProperty("cookingManager").objectReferenceValue = thermo;
            serUI.FindProperty("timeText").objectReferenceValue = timeText;
            serUI.FindProperty("comboText").objectReferenceValue = comboText;
            serUI.FindProperty("feedbackText").objectReferenceValue = feedbackText;
            serUI.FindProperty("drynessSlider").objectReferenceValue = drySlider;
            serUI.FindProperty("heatSlider").objectReferenceValue = heatSlider;

            serUI.FindProperty("eggButton").objectReferenceValue = eggBtn;
            serUI.FindProperty("riceButton").objectReferenceValue = riceBtn;
            serUI.FindProperty("meatButton").objectReferenceValue = meatBtn;
            serUI.FindProperty("onionButton").objectReferenceValue = onionBtn;
            serUI.FindProperty("soyButton").objectReferenceValue = soyBtn;
            serUI.FindProperty("ladleButton").objectReferenceValue = ladleBtn;

            serUI.FindProperty("resultPanel").objectReferenceValue = resultPanel;
            serUI.FindProperty("resultScoreText").objectReferenceValue = scoreText;
            serUI.FindProperty("resultRankText").objectReferenceValue = rankText;
            serUI.FindProperty("resultTitleText").objectReferenceValue = titleText;
            serUI.FindProperty("resultCommentText").objectReferenceValue = commentText;
            serUI.FindProperty("retryButton").objectReferenceValue = retryBtn;
            serUI.ApplyModifiedProperties();
        }

        private static GameObject CreateUIPanel(GameObject parent, string name, Vector2 anchorMin, Vector2 anchorMax, Vector2 pivot, Vector2 pos, Vector2 size, Color? col = null)
        {
            GameObject panel = new GameObject(name);
            panel.transform.SetParent(parent.transform, false);
            var rect = panel.AddComponent<RectTransform>();
            rect.anchorMin = anchorMin; rect.anchorMax = anchorMax; rect.pivot = pivot;
            rect.anchoredPosition = pos; rect.sizeDelta = size;
            var img = panel.AddComponent<Image>();
            img.color = col ?? new Color(0.1f, 0.11f, 0.14f, 0.85f);
            return panel;
        }

        private static Text CreateUIText(GameObject parent, string name, string textVal, Font font, int fontSize, FontStyle style, Color col, Vector2 normalizedPos, Vector2 size)
        {
            GameObject obj = new GameObject(name);
            obj.transform.SetParent(parent.transform, false);
            var rect = obj.AddComponent<RectTransform>();
            rect.anchorMin = normalizedPos; rect.anchorMax = normalizedPos; rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = Vector2.zero; rect.sizeDelta = size;
            var txt = obj.AddComponent<Text>();
            txt.font = font; txt.text = textVal; txt.fontSize = fontSize; txt.fontStyle = style;
            txt.alignment = TextAnchor.MiddleCenter; txt.color = col;
            return txt;
        }

        private static Button CreateUIButton(GameObject parent, string name, string label, Font font, int fontSize, Vector2 anchoredPos, Vector2 size, Color? btnCol = null)
        {
            GameObject obj = new GameObject(name);
            obj.transform.SetParent(parent.transform, false);
            var rect = obj.AddComponent<RectTransform>();
            rect.anchorMin = new Vector2(0.5f, 0.5f); rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = anchoredPos; rect.sizeDelta = size;
            var img = obj.AddComponent<Image>();
            img.color = btnCol ?? new Color(0.24f, 0.25f, 0.32f);
            var btn = obj.AddComponent<Button>();
            btn.targetGraphic = img;

            GameObject lblObj = new GameObject("Label");
            lblObj.transform.SetParent(obj.transform, false);
            var lblRect = lblObj.AddComponent<RectTransform>();
            lblRect.anchorMin = Vector2.zero; lblRect.anchorMax = Vector2.one; lblRect.sizeDelta = Vector2.zero;
            var txt = lblObj.AddComponent<Text>();
            txt.font = font; txt.text = label; txt.fontSize = fontSize; txt.fontStyle = FontStyle.Bold;
            txt.alignment = TextAnchor.MiddleCenter; txt.color = Color.white;
            return btn;
        }

        private static Slider CreateUISlider(GameObject parent, string name, Vector2 pos, Vector2 size, Color fillCol)
        {
            GameObject sliderObj = new GameObject(name);
            sliderObj.transform.SetParent(parent.transform, false);
            var rect = sliderObj.AddComponent<RectTransform>();
            rect.anchorMin = new Vector2(pos.x, 0.5f); rect.anchorMax = new Vector2(pos.x, 0.5f);
            rect.anchoredPosition = new Vector2(0, pos.y); rect.sizeDelta = size;
            var slider = sliderObj.AddComponent<Slider>();

            GameObject bg = new GameObject("Background");
            bg.transform.SetParent(sliderObj.transform, false);
            var bgRect = bg.AddComponent<RectTransform>();
            bgRect.anchorMin = Vector2.zero; bgRect.anchorMax = Vector2.one; bgRect.sizeDelta = Vector2.zero;
            var bgImg = bg.AddComponent<Image>();
            bgImg.color = new Color(0.15f, 0.16f, 0.2f);

            GameObject fill = new GameObject("Fill");
            fill.transform.SetParent(sliderObj.transform, false);
            var fillRect = fill.AddComponent<RectTransform>();
            fillRect.anchorMin = Vector2.zero; fillRect.anchorMax = Vector2.one; fillRect.sizeDelta = Vector2.zero;
            var fillImg = fill.AddComponent<Image>();
            fillImg.color = fillCol;

            slider.fillRect = fillRect; slider.minValue = 0f; slider.maxValue = 1f; slider.value = 0f;
            return slider;
        }
    }
}
