using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;

namespace ChahanGame.Editor
{
    public static class SceneSetupHelper
    {
        [MenuItem("Chahan Game/Setup Main Scene (自動セットアップ)")]
        public static void BuildSceneBatch()
        {
            Debug.Log("[ChahanGame] 完全自動シーンセットアップを開始します...");

            // 1. マテリアルの作成
            Shader riceShader = Shader.Find("Custom/RiceGrainInstanced");
            if (riceShader == null) riceShader = Shader.Find("Standard");

            Material riceMat = new Material(riceShader);
            riceMat.enableInstancing = true;
            AssetDatabase.CreateAsset(riceMat, "Assets/Materials/RiceInstancedMaterial.mat");

            // 鍋マテリアル
            Material wokMat = new Material(Shader.Find("Standard"));
            wokMat.color = new Color(0.12f, 0.13f, 0.15f);
            wokMat.SetFloat("_Glossiness", 0.75f);
            wokMat.SetFloat("_Metallic", 0.85f);
            AssetDatabase.CreateAsset(wokMat, "Assets/Materials/WokIronMaterial.mat");

            // 取っ手マテリアル (木製)
            Material woodMat = new Material(Shader.Find("Standard"));
            woodMat.color = new Color(0.42f, 0.26f, 0.14f);
            woodMat.SetFloat("_Glossiness", 0.35f);
            AssetDatabase.CreateAsset(woodMat, "Assets/Materials/WoodHandleMaterial.mat");

            // チャーシューマテリアル (角切り赤身)
            Material meatMat = new Material(Shader.Find("Standard"));
            meatMat.color = new Color(0.72f, 0.16f, 0.12f);
            meatMat.SetFloat("_Glossiness", 0.4f);
            meatMat.enableInstancing = true;
            AssetDatabase.CreateAsset(meatMat, "Assets/Materials/MeatMaterial.mat");

            // ネギマテリアル (鮮やかなグリーン)
            Material onionMat = new Material(Shader.Find("Standard"));
            onionMat.color = new Color(0.24f, 0.78f, 0.28f);
            onionMat.SetFloat("_Glossiness", 0.45f);
            onionMat.enableInstancing = true;
            AssetDatabase.CreateAsset(onionMat, "Assets/Materials/OnionMaterial.mat");

            // 2. プロシージャルMesh生成
            Mesh riceMesh = CreateRiceMesh();
            AssetDatabase.CreateAsset(riceMesh, "Assets/Materials/RiceGrainMesh.asset");

            Mesh wokMesh = CreateWokMesh(1.6f, 0.8f, 32, 16);
            AssetDatabase.CreateAsset(wokMesh, "Assets/Materials/WokBowlMesh.asset");

            Mesh meatMesh = CreateCubeMesh(0.15f);
            AssetDatabase.CreateAsset(meatMesh, "Assets/Materials/MeatCubeMesh.asset");

            Mesh onionMesh = CreateCylinderMesh(0.1f, 0.08f, 10);
            AssetDatabase.CreateAsset(onionMesh, "Assets/Materials/OnionCylinderMesh.asset");

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            // 3. AudioClipsのロード
            AudioClip tossClip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Audio/toss.wav");
            AudioClip sizzleClip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Audio/sizzle.wav");
            AudioClip addClip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Audio/add.wav");
            AudioClip soyClip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Audio/soy.wav");
            AudioClip platingClip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Audio/plating.wav");
            AudioClip wokHeiClip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Audio/wokhei.wav");

            // 4. 新規シーン作成
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            // カメラ配置
            GameObject camObj = new GameObject("Main Camera");
            camObj.tag = "MainCamera";
            Camera cam = camObj.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.08f, 0.08f, 0.1f);
            camObj.transform.position = new Vector3(0f, 3.4f, -1.9f);
            camObj.transform.rotation = Quaternion.Euler(58f, 0f, 0f);
            camObj.AddComponent<AudioListener>();

            // ライト配置
            GameObject lightObj = new GameObject("Directional Light");
            Light light = lightObj.AddComponent<Light>();
            light.type = LightType.Directional;
            light.color = new Color(1f, 0.95f, 0.85f);
            light.intensity = 1.25f;
            lightObj.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

            // 中華鍋の配置
            GameObject wokRoot = new GameObject("ChahanWok");
            GameObject wokBowl = new GameObject("WokBowl");
            wokBowl.transform.SetParent(wokRoot.transform);
            var wokFilter = wokBowl.AddComponent<MeshFilter>();
            wokFilter.sharedMesh = wokMesh;
            var wokRenderer = wokBowl.AddComponent<MeshRenderer>();
            wokRenderer.sharedMaterial = wokMat;

            // 中華鍋の取っ手（手前）
            GameObject handle = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            handle.name = "WokHandle";
            handle.transform.SetParent(wokRoot.transform);
            handle.transform.localPosition = new Vector3(0f, 0.5f, -1.95f);
            handle.transform.localRotation = Quaternion.Euler(80f, 0f, 0f);
            handle.transform.localScale = new Vector3(0.12f, 0.45f, 0.12f);
            handle.GetComponent<MeshRenderer>().sharedMaterial = woodMat;
            Object.DestroyImmediate(handle.GetComponent<Collider>());

            // 5. GameManager配置
            GameObject gmObj = new GameObject("GameManager");
            var tossDetector = gmObj.AddComponent<TossGestureDetector>();
            var riceController = gmObj.AddComponent<RiceParticleController>();
            var audioMgr = gmObj.AddComponent<ChahanAudioManager>();
            var thermo = gmObj.AddComponent<CookingThermodynamics>();
            var uiController = gmObj.AddComponent<ChahanUIController>();

            // AudioSource設定
            AudioSource sfxSrc = gmObj.AddComponent<AudioSource>();
            sfxSrc.playOnAwake = false;
            AudioSource loopSrc = gmObj.AddComponent<AudioSource>();
            loopSrc.playOnAwake = false;

            // ChahanAudioManager 設定
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

            // RiceParticleController 設定
            var serRice = new SerializedObject(riceController);
            serRice.FindProperty("riceMesh").objectReferenceValue = riceMesh;
            serRice.FindProperty("riceMaterial").objectReferenceValue = riceMat;
            serRice.FindProperty("meatMesh").objectReferenceValue = meatMesh;
            serRice.FindProperty("meatMaterial").objectReferenceValue = meatMat;
            serRice.FindProperty("onionMesh").objectReferenceValue = onionMesh;
            serRice.FindProperty("onionMaterial").objectReferenceValue = onionMat;
            serRice.FindProperty("maxRiceCount").intValue = 800;
            serRice.FindProperty("maxMeatCount").intValue = 25;
            serRice.FindProperty("maxOnionCount").intValue = 35;
            serRice.ApplyModifiedProperties();

            // CookingThermodynamics 設定
            var serThermo = new SerializedObject(thermo);
            serThermo.FindProperty("gestureDetector").objectReferenceValue = tossDetector;
            serThermo.FindProperty("riceController").objectReferenceValue = riceController;
            serThermo.FindProperty("audioManager").objectReferenceValue = audioMgr;
            serThermo.ApplyModifiedProperties();

            // 6. UI (Canvas) の構築
            BuildUIHierarchy(canvasObjOut: out Canvas canvas,
                             uiCtrl: uiController,
                             thermo: thermo,
                             font: Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"));

            EditorSceneManager.SaveScene(scene, "Assets/Scenes/MainChahanScene.unity");
            Debug.Log("[ChahanGame] 完全自動セットアップが完了しました！Assets/Scenes/MainChahanScene.unity");
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

            // --- 上部HUDパネル ---
            GameObject topHud = CreateUIPanel(canvasObj, "TopHUD", new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0, -120), new Vector2(0, 240));

            // TIME
            Text timeText = CreateUIText(topHud, "TimeText", "45", font, 52, FontStyle.Bold, Color.yellow, new Vector2(0.1f, 0.5f), new Vector2(120, 80));

            // COMBO
            Text comboText = CreateUIText(topHud, "ComboText", "COMBO 0", font, 36, FontStyle.Bold, new Color(1f, 0.6f, 0.1f), new Vector2(0.5f, 0.7f), new Vector2(300, 60));

            // FEEDBACK
            Text feedbackText = CreateUIText(topHud, "FeedbackText", "READY", font, 34, FontStyle.Bold, Color.green, new Vector2(0.5f, 0.28f), new Vector2(700, 60));

            // パラパラ度スライダー
            Slider drySlider = CreateUISlider(topHud, "DrynessSlider", new Vector2(0.3f, -40), new Vector2(260, 24), new Color(0.2f, 0.6f, 1f));

            // 熱量スライダー
            Slider heatSlider = CreateUISlider(topHud, "HeatSlider", new Vector2(0.7f, -40), new Vector2(260, 24), new Color(1f, 0.3f, 0.2f));

            // --- 下部ボタングリッド ---
            GameObject botHud = CreateUIPanel(canvasObj, "BottomHUD", new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(0, 220), new Vector2(0, 440));

            Button eggBtn = CreateUIButton(botHud, "EggBtn", "🥚 溶き卵", font, 28, new Vector2(-360, 80), new Vector2(220, 110));
            Button riceBtn = CreateUIButton(botHud, "RiceBtn", "🍚 ご飯", font, 28, new Vector2(-120, 80), new Vector2(220, 110));
            Button meatBtn = CreateUIButton(botHud, "MeatBtn", "🥩 肉", font, 28, new Vector2(120, 80), new Vector2(220, 110));
            Button onionBtn = CreateUIButton(botHud, "OnionBtn", "🌱 ネギ", font, 28, new Vector2(360, 80), new Vector2(220, 110));

            Button soyBtn = CreateUIButton(botHud, "SoyBtn", "🍶 鍋肌醤油", font, 30, new Vector2(-220, -50), new Vector2(360, 110), new Color(0.45f, 0.2f, 0.12f));
            Button ladleBtn = CreateUIButton(botHud, "LadleBtn", "🥄 お玉まとめ", font, 30, new Vector2(220, -50), new Vector2(360, 110), new Color(0.18f, 0.32f, 0.5f));

            // --- リザルトパネル ---
            GameObject resultPanel = CreateUIPanel(canvasObj, "ResultPanel", new Vector2(0f, 0f), new Vector2(1f, 1f), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero, new Color(0.05f, 0.05f, 0.08f, 0.94f));

            Text rankText = CreateUIText(resultPanel, "RankText", "S", font, 110, FontStyle.Bold, Color.yellow, new Vector2(0.5f, 0.78f), new Vector2(200, 140));
            Text titleText = CreateUIText(resultPanel, "TitleText", "町中華の生ける伝説", font, 46, FontStyle.Bold, Color.white, new Vector2(0.5f, 0.68f), new Vector2(700, 80));
            Text scoreText = CreateUIText(resultPanel, "ScoreText", "96 / 100", font, 54, FontStyle.Bold, new Color(1f, 0.8f, 0.2f), new Vector2(0.5f, 0.56f), new Vector2(500, 80));
            Text commentText = CreateUIText(resultPanel, "CommentText", "「完璧だ…！至高の一皿！」", font, 30, FontStyle.Normal, Color.white, new Vector2(0.5f, 0.42f), new Vector2(750, 160));
            Button retryBtn = CreateUIButton(resultPanel, "RetryBtn", "もう一丁作る！", font, 36, new Vector2(0, -320), new Vector2(400, 120), new Color(0.9f, 0.6f, 0.1f));

            resultPanel.SetActive(false);

            // ChahanUIController へのバインド
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
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.pivot = pivot;
            rect.anchoredPosition = pos;
            rect.sizeDelta = size;

            var img = panel.AddComponent<Image>();
            img.color = col ?? new Color(0.1f, 0.11f, 0.14f, 0.85f);
            return panel;
        }

        private static Text CreateUIText(GameObject parent, string name, string textVal, Font font, int fontSize, FontStyle style, Color col, Vector2 normalizedPos, Vector2 size)
        {
            GameObject obj = new GameObject(name);
            obj.transform.SetParent(parent.transform, false);
            var rect = obj.AddComponent<RectTransform>();
            rect.anchorMin = normalizedPos;
            rect.anchorMax = normalizedPos;
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = size;

            var txt = obj.AddComponent<Text>();
            txt.font = font;
            txt.text = textVal;
            txt.fontSize = fontSize;
            txt.fontStyle = style;
            txt.alignment = TextAnchor.MiddleCenter;
            txt.color = col;
            return txt;
        }

        private static Button CreateUIButton(GameObject parent, string name, string label, Font font, int fontSize, Vector2 anchoredPos, Vector2 size, Color? btnCol = null)
        {
            GameObject obj = new GameObject(name);
            obj.transform.SetParent(parent.transform, false);
            var rect = obj.AddComponent<RectTransform>();
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = anchoredPos;
            rect.sizeDelta = size;

            var img = obj.AddComponent<Image>();
            img.color = btnCol ?? new Color(0.24f, 0.25f, 0.32f);

            var btn = obj.AddComponent<Button>();
            btn.targetGraphic = img;

            // ラベル
            GameObject lblObj = new GameObject("Label");
            lblObj.transform.SetParent(obj.transform, false);
            var lblRect = lblObj.AddComponent<RectTransform>();
            lblRect.anchorMin = Vector2.zero;
            lblRect.anchorMax = Vector2.one;
            lblRect.sizeDelta = Vector2.zero;

            var txt = lblObj.AddComponent<Text>();
            txt.font = font;
            txt.text = label;
            txt.fontSize = fontSize;
            txt.fontStyle = FontStyle.Bold;
            txt.alignment = TextAnchor.MiddleCenter;
            txt.color = Color.white;

            return btn;
        }

        private static Slider CreateUISlider(GameObject parent, string name, Vector2 pos, Vector2 size, Color fillCol)
        {
            GameObject sliderObj = new GameObject(name);
            sliderObj.transform.SetParent(parent.transform, false);
            var rect = sliderObj.AddComponent<RectTransform>();
            rect.anchorMin = new Vector2(pos.x, 0.5f);
            rect.anchorMax = new Vector2(pos.x, 0.5f);
            rect.anchoredPosition = new Vector2(0, pos.y);
            rect.sizeDelta = size;

            var slider = sliderObj.AddComponent<Slider>();

            // 背景
            GameObject bg = new GameObject("Background");
            bg.transform.SetParent(sliderObj.transform, false);
            var bgRect = bg.AddComponent<RectTransform>();
            bgRect.anchorMin = Vector2.zero;
            bgRect.anchorMax = Vector2.one;
            bgRect.sizeDelta = Vector2.zero;
            var bgImg = bg.AddComponent<Image>();
            bgImg.color = new Color(0.15f, 0.16f, 0.2f);

            // Fill
            GameObject fill = new GameObject("Fill");
            fill.transform.SetParent(sliderObj.transform, false);
            var fillRect = fill.AddComponent<RectTransform>();
            fillRect.anchorMin = Vector2.zero;
            fillRect.anchorMax = Vector2.one;
            fillRect.sizeDelta = Vector2.zero;
            var fillImg = fill.AddComponent<Image>();
            fillImg.color = fillCol;

            slider.fillRect = fillRect;
            slider.minValue = 0f;
            slider.maxValue = 1f;
            slider.value = 0f;

            return slider;
        }

        private static Mesh CreateRiceMesh()
        {
            Mesh mesh = new Mesh { name = "RiceGrain" };
            int latLines = 10, lonLines = 10;
            int vertCount = (latLines + 1) * (lonLines + 1);
            Vector3[] vertices = new Vector3[vertCount];
            Vector3[] normals = new Vector3[vertCount];
            Vector2[] uvs = new Vector2[vertCount];
            int[] triangles = new int[latLines * lonLines * 6];

            int v = 0;
            for (int i = 0; i <= latLines; i++)
            {
                float lat = Mathf.PI * (-0.5f + (float)i / latLines);
                float sinLat = Mathf.Sin(lat), cosLat = Mathf.Cos(lat);
                for (int j = 0; j <= lonLines; j++)
                {
                    float lon = 2f * Mathf.PI * (float)j / lonLines;
                    Vector3 n = new Vector3(cosLat * Mathf.Cos(lon), sinLat, cosLat * Mathf.Sin(lon));
                    vertices[v] = new Vector3(n.x * 0.45f, n.y * 0.45f, n.z * 1.2f);
                    normals[v] = n;
                    uvs[v] = new Vector2((float)j / lonLines, (float)i / latLines);
                    v++;
                }
            }

            int t = 0;
            for (int i = 0; i < latLines; i++)
            {
                for (int j = 0; j < lonLines; j++)
                {
                    int first = (i * (lonLines + 1)) + j;
                    int second = first + lonLines + 1;
                    triangles[t++] = first; triangles[t++] = second; triangles[t++] = first + 1;
                    triangles[t++] = second; triangles[t++] = second + 1; triangles[t++] = first + 1;
                }
            }

            mesh.vertices = vertices; mesh.normals = normals; mesh.uv = uvs; mesh.triangles = triangles;
            mesh.RecalculateBounds();
            return mesh;
        }

        private static Mesh CreateWokMesh(float radius, float curvature, int radialSteps, int heightSteps)
        {
            Mesh mesh = new Mesh { name = "WokBowl" };
            int vertCount = (heightSteps + 1) * (radialSteps + 1);
            Vector3[] vertices = new Vector3[vertCount];
            Vector3[] normals = new Vector3[vertCount];
            int[] triangles = new int[heightSteps * radialSteps * 6];

            int v = 0;
            for (int h = 0; h <= heightSteps; h++)
            {
                float r = ((float)h / heightSteps) * radius;
                float y = curvature * (r * r);
                for (int s = 0; s <= radialSteps; s++)
                {
                    float angle = 2f * Mathf.PI * (float)s / radialSteps;
                    float x = Mathf.Cos(angle) * r, z = Mathf.Sin(angle) * r;
                    vertices[v] = new Vector3(x, y, z);
                    normals[v] = -new Vector3(-2f * curvature * x, 1f, -2f * curvature * z).normalized;
                    v++;
                }
            }

            int t = 0;
            for (int h = 0; h < heightSteps; h++)
            {
                for (int s = 0; s < radialSteps; s++)
                {
                    int first = (h * (radialSteps + 1)) + s;
                    int second = first + radialSteps + 1;
                    triangles[t++] = first; triangles[t++] = first + 1; triangles[t++] = second;
                    triangles[t++] = second; triangles[t++] = first + 1; triangles[t++] = second + 1;
                }
            }

            mesh.vertices = vertices; mesh.normals = normals; mesh.triangles = triangles;
            mesh.RecalculateBounds();
            return mesh;
        }

        private static Mesh CreateCubeMesh(float size)
        {
            GameObject temp = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Mesh mesh = Object.Instantiate(temp.GetComponent<MeshFilter>().sharedMesh);
            mesh.name = "MeatCube";
            Object.DestroyImmediate(temp);

            Vector3[] v = mesh.vertices;
            for (int i = 0; i < v.Length; i++) v[i] *= size;
            mesh.vertices = v;
            mesh.RecalculateBounds();
            return mesh;
        }

        private static Mesh CreateCylinderMesh(float radius, float height, int segments)
        {
            GameObject temp = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Mesh mesh = Object.Instantiate(temp.GetComponent<MeshFilter>().sharedMesh);
            mesh.name = "OnionCylinder";
            Object.DestroyImmediate(temp);

            Vector3[] v = mesh.vertices;
            for (int i = 0; i < v.Length; i++)
            {
                v[i].x *= radius;
                v[i].z *= radius;
                v[i].y *= height;
            }
            mesh.vertices = v;
            mesh.RecalculateBounds();
            return mesh;
        }
    }
}
