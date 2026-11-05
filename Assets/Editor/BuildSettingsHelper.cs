using UnityEditor;
using UnityEngine;

namespace ChahanGame.Editor
{
    public static class BuildSettingsHelper
    {
        [MenuItem("Chahan Game/Register Scene to Build Settings")]
        public static void RegisterScene()
        {
            var scenes = new EditorBuildSettingsScene[]
            {
                new EditorBuildSettingsScene("Assets/Scenes/MainChahanScene.unity", true)
            };
            EditorBuildSettings.scenes = scenes;
            Debug.Log("[ChahanGame] Assets/Scenes/MainChahanScene.unity を Build Settings に登録しました！");
        }
    }
}
