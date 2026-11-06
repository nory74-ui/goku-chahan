Shader "Custom/PhotorealRice"
{
    Properties
    {
        _ColorRaw ("Raw Rice (白米)", Color) = (0.97, 0.96, 0.91, 1)
        _ColorEgg ("Egg Coated (卵絡み)", Color) = (1.0, 0.88, 0.38, 1)
        _ColorGolden ("Golden Parapara (黄金)", Color) = (1.0, 0.74, 0.12, 1)
        _ColorBrown ("Toasted Fox (きつね色)", Color) = (0.75, 0.42, 0.14, 1)
        _ColorBurnt ("Burnt Carbon (黒焦げ)", Color) = (0.18, 0.08, 0.04, 1)

        [Header(Subsurface Scattering Translucency)]
        _SSSColor ("SSS Translucent Color", Color) = (1.0, 0.95, 0.80, 1)
        _SSSPower ("SSS Power", Range(1, 10)) = 4.0
        _SSSScale ("SSS Intensity", Range(0, 2)) = 0.65

        [Header(Oil Clearcoat)]
        _OilSmoothness ("Oil Clearcoat Smoothness", Range(0, 1)) = 0.88
        _OilFresnel ("Oil Fresnel Power", Range(1, 5)) = 3.0
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        LOD 300

        CGPROGRAM
        #pragma surface surf StandardSpecular fullforwardshadows addshadow
        #pragma multi_compile_instancing
        #pragma target 3.0

        struct Input
        {
            float3 worldNormal;
            float3 viewDir;
            float3 worldPos;
            INTERNAL_DATA
        };

        fixed4 _ColorRaw;
        fixed4 _ColorEgg;
        fixed4 _ColorGolden;
        fixed4 _ColorBrown;
        fixed4 _ColorBurnt;

        fixed4 _SSSColor;
        half _SSSPower;
        half _SSSScale;

        half _OilSmoothness;
        half _OilFresnel;

        UNITY_INSTANCING_BUFFER_START(Props)
            UNITY_DEFINE_INSTANCED_PROP(float, _CookState)
        UNITY_INSTANCING_BUFFER_END(Props)

        void surf (Input IN, inout SurfaceOutputStandardSpecular o)
        {
            float cook = UNITY_ACCESS_INSTANCED_PROP(Props, _CookState);

            // 1. 動的メイラード反応によるベースカラー計算
            fixed4 albedo;
            half smoothness = _OilSmoothness;
            half3 specColor = half3(0.06, 0.06, 0.06); // 油膜の基本誘電体反射

            if (cook < 0.5)
            {
                // 白米 -> 卵コーティング
                float t = saturate(cook / 0.5);
                albedo = lerp(_ColorRaw, _ColorEgg, t);
            }
            else if (cook < 1.0)
            {
                // 卵コーティング -> 黄金パラパラ
                float t = saturate((cook - 0.5) / 0.5);
                albedo = lerp(_ColorEgg, _ColorGolden, t);
                specColor = half3(0.09, 0.08, 0.05); // 黄金の微細な油照り
            }
            else if (cook < 1.5)
            {
                // 黄金パラパラ -> 香ばしいきつね色
                float t = saturate((cook - 1.0) / 0.5);
                albedo = lerp(_ColorGolden, _ColorBrown, t);
            }
            else
            {
                // きつね色 -> 黒焦げ炭化
                float t = saturate((cook - 1.5) / 0.5);
                albedo = lerp(_ColorBrown, _ColorBurnt, t);
                smoothness = lerp(_OilSmoothness, 0.2, t); // 焦げると油分が蒸発しカサつく
                specColor = lerp(specColor, half3(0.02, 0.02, 0.02), t);
            }

            // 2. 油膜フレネル（斜めから見たときに鋭く光る濡れ感）
            float NdotV = saturate(dot(IN.worldNormal, normalize(IN.viewDir)));
            float fresnel = pow(1.0 - NdotV, _OilFresnel);
            specColor += fresnel * 0.28;

            // 3. Subsurface Scattering (内部散乱・透け感) 近似
            // 逆光・エッジ部で光が米粒内部を透けてふんわり光る
            float sss = pow(1.0 - NdotV, _SSSPower) * _SSSScale;
            albedo.rgb += _SSSColor.rgb * sss * (1.0 - saturate(cook * 0.5)); // 焦げると透けなくなる

            o.Albedo = albedo.rgb;
            o.Specular = specColor;
            o.Smoothness = smoothness;
            o.Occlusion = 1.0;
            o.Alpha = 1.0;
        }
        ENDCG
    }
    FallBack "Standard"
}
