export const handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ 
      message: 'Netlify function is working!',
      timestamp: new Date().toISOString(),
      path: event.path,
      method: event.httpMethod
    })
  }
} 