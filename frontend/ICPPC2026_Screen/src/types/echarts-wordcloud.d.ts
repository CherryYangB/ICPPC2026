// echarts-wordcloud 未随包提供类型声明，这里补一个环境声明。
// tsconfig.app.json 开启了 noUncheckedSideEffectImports，
// 没有该声明时 `import 'echarts-wordcloud'` 会报 TS2307。
declare module 'echarts-wordcloud'
