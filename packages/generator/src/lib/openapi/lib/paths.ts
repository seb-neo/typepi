import { HttpVerb, ParameterObject, PathItemObject, ReferenceObject, RequestBody, ResponseObject, Route, SchemaObject } from './types'

const expressifyPath = (path: string): string => (
  path.replace(/{/g, ':').replace(/}/g, '')
)

const parseRef = ( { $ref }: ReferenceObject): string => {
  return $ref.substring($ref.lastIndexOf('/') + 1)
}

const parseSchema = (schema: SchemaObject): string => {
  return ''
}

const parseResponse = (response: ResponseObject): string => {
  const schema = response.content?.['application/json']?.schema

  if (!schema) return ''
  if ('$ref' in schema) return parseRef(schema)
  
  return parseSchema(schema)
}

const getType = (param: ParameterObject): string => {
  if (param.type) return param.type
  if (param.schema) {
    if ('type' in param.schema) return param.schema.type
  }
  return 'any'
}

const generateProps = (params: Array<ReferenceObject | ParameterObject>, filter: 'query' | 'header' | 'path' | /* V3 */ 'cookie' | /* V2 */ 'formData' | /* V2 */ 'body'): string => {
  const props = (params as ParameterObject[])
    .filter((p) => p.in === filter)
    .map((p) => `${p.name}: ${getType(p)}`)

  if (props.length) return `{${props.join(', ')}}`

  return 'never'
}

const generateBody = (body: RequestBody): string => {
  if (body?.content?.['application/json']) {
    const content = body.content['application/json']

    if ('$ref' in content.schema) {
      return parseRef(content.schema)
    }
  }

  return 'never'
}

const generateResult = (responses: Record<string, ReferenceObject | ResponseObject>): string => {
  const responseTypes = Object
    .entries(responses)
    .map(([strCode, response]) => {
      if ('$ref' in response) return parseRef(response)
      
      return parseResponse(response)
    })
    .filter(r => r)
  if (responseTypes.length) return responseTypes.join(' | ')

  return 'never'
}

const generateRoutes = (path: string, item: PathItemObject): Route[] => {
  const verbs: HttpVerb[] = ['get', 'post', 'put', 'patch', 'delete']

  const routes: Array<Route | undefined> = verbs.map((verb) => {
    const operation = item[verb]
    if (!operation) return undefined

    return {
      url: expressifyPath(path),
      method: verb,
      requestBody: generateBody(operation.requestBody as RequestBody),
      requestParams: generateProps(operation.parameters || [], 'path'),
      requestQuery: generateProps(operation.parameters || [], 'query'),
      resultBody: generateResult(operation.responses),
    } 
  })

  return routes.filter(r => r)
}

export const generatePaths = (paths: Record<string, PathItemObject>): Route[] => {
  return Object
    .entries(paths)
    .flatMap(([path, item]) => generateRoutes(path, item))
}
