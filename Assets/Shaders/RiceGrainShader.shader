Shader "Custom/RiceGrainInstanced"
{
    Properties
    {
        _ColorRaw ("Raw Rice Color", Color) = (0.98, 0.98, 0.92, 1)
        _ColorEgg ("Egg Coated Color", Color) = (1.0, 0.92, 0.45, 1)
        _ColorGolden ("Golden Parapara Color", Color) = (1.0, 0.78, 0.15, 1)
        _ColorBurnt ("Burnt Color", Color) = (0.32, 0.18, 0.12, 1)
        _Glossiness ("Smoothness", Range(0,1)) = 0.6
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 200

        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows addshadow
        #pragma multi_compile_instancing
        #pragma target 3.0

        struct Input
        {
            float3 worldNormal;
        };

        fixed4 _ColorRaw;
        fixed4 _ColorEgg;
        fixed4 _ColorGolden;
        fixed4 _ColorBurnt;
        half _Glossiness;

        UNITY_INSTANCING_BUFFER_START(Props)
            UNITY_DEFINE_INSTANCED_PROP(float, _CookState)
        UNITY_INSTANCING_BUFFER_END(Props)

        void surf (Input IN, inout SurfaceOutputStandard o)
        {
            float cook = UNITY_ACCESS_INSTANCED_PROP(Props, _CookState);

            fixed4 finalColor;
            if (cook < 0.5)
            {
                // 白米 -> 卵コーティング
                float t = saturate(cook / 0.5);
                finalColor = lerp(_ColorRaw, _ColorEgg, t);
            }
            else if (cook < 1.0)
            {
                // 卵コーティング -> 黄金パラパラ
                float t = saturate((cook - 0.5) / 0.5);
                finalColor = lerp(_ColorEgg, _ColorGolden, t);
            }
            else
            {
                // 黄金パラパラ -> コゲ
                float t = saturate(cook - 1.0);
                finalColor = lerp(_ColorGolden, _ColorBurnt, t);
            }

            o.Albedo = finalColor.rgb;
            o.Smoothness = _Glossiness;
            o.Metallic = 0.0;
            o.Alpha = 1.0;
        }
        ENDCG
    }
    FallBack "Diffuse"
}
