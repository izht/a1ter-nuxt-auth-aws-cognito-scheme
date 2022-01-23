just test

```bash
# nuxt.config.js

export default {
  mode: 'universal',

  modules: [
      '@nuxtjs/axios',
      '@nuxtjs/auth-next'
  ],

  build: {
      transpile: ['@nuxtjs/auth-next']
  },

  axios: {
		baseURL: process.env.BASE_API_URL
	},

  auth: {
    strategies: {
      cognito: {
        scheme: '@a1ter/nuxt-auth-aws-cognito-scheme/scheme/scheme',
        credentials: {
          userPoolId: process.env.COGNITO_USER_POOL_ID,
          userPoolWebClientId: process.env.COGNITO_USER_POOL_WEB_CLIENT_ID,
          region: process.env.COGNITO_REGION
        }
      }
    }
  }
}
```
