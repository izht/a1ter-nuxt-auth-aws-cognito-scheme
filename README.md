A backup of @a1ter/nuxt-auth-aws-cognito-scheme  from https://www.npmjs.com/package/@a1ter/nuxt-auth-aws-cognito-scheme
since the repo at https://bitbucket.org/A1ter/nuxt-auth-aws-cognito-scheme is unaccessable on 23/01/2022 


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
